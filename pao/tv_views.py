import json
from django.contrib import messages
from django.db import models
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse_lazy
from django.views.decorators.http import require_http_methods, require_GET
from core.decorators import login_required_hx
from ipware import get_client_ip
from pao.forms import FittingForm, TVLineFactorForm
from pao.models import AnalysisProfile, TVColorFilter, TVLineFactor, AnalysisProfilePermission, ProfileTVAdditions, ProfileDOE, DOE, TVDeltaVBaseline

from pao.utils.pivot_table import (
	TVSpectrumAnalyzer, 
	tv_generate_base_table,
	tv_generate_lt_table, 
	tv_generate_ivl_table, 
	tv_get_row_header,
	tv_get_valid_does_grouped, 
	tv_process_color_filter_upload, 
	tv_generate_angle_table,
	calculate_spectrum_averages,
	calculate_angle_uv_components
)

from utls.plotly_tv import (
	generate_delta_v_chart_data,
	generate_jv_chart_data,
	generate_cj_chart_data,
	generate_spectrum_chart_data,
	
)

from pao.views import get_selected_doe
import logging



logger = logging.getLogger(__name__)

@login_required_hx
def compare_tv(request: HttpRequest, profile_id: int) -> HttpResponse:
    """TV 분석 페이지
    
    Args:
        request: HTTP 요청
        profile_id: 분석 프로필 ID (URL 경로에서 전달)
    
    Returns:
        compare_tv.html 렌더링
    """
    # 1. DOE 검증
    tag, doe_result = get_selected_doe(request)
    
    match tag:
        case "warning":
            getattr(messages, tag)(request, doe_result)
            return redirect(reverse_lazy("pao:device_list") + f"?profile_id={profile_id}")
        
        case "success":
            # 2. Profile 권한 체크
            profile = get_object_or_404(AnalysisProfile, id=profile_id, product_type="TV")
            
            try:
                profile_permission = AnalysisProfilePermission.objects.get(
                    profile_id=profile_id, 
                    user_id=request.user.id
                )
            except AnalysisProfilePermission.DoesNotExist:
                messages.warning(request, "프로필 접근 권한이 없습니다.")
                return redirect(reverse_lazy("pao:analysis-profiles"))
            
            permission_level = profile_permission.permission_level
            
            # 3. TVAdditions 가져오기 (없으면 None)
            tv_additions = getattr(profile, "tv_additions", None)
            
            # 4. 필터 옵션 리스트
            fitting_form = FittingForm()
            color_filters = list(
			    TVColorFilter.objects.all().order_by("label")
			)
			
			line_factors = list(
			    TVLineFactor.objects.all().order_by("label")
			)
			
			deltav_baselines = list(
			    TVDeltaVBaseline.objects.all().order_by("label")
			)

            
            # doe_result를 JavaScript에서 사용할 수 있는 JSON 형식으로 변환
            selected_does_json = json.dumps([
                {
                    "id": doe.id,
                    "model": doe.model,
                    "exp_date": str(doe.created_at.date()),  # AccessLog의 created_at 사용
                    "color": doe.color,
                    "runsheet_lot": doe.runsheet_lot,
                    "gls_id": doe.gls_id,
                    "sequence": doe.sequence if doe.sequence else '0',
                }
                for doe in doe_result
            ])
            
            # 6. Layouts를 JSON으로 직렬화 (차트 초기화용)
            tv_processor = TVPlotlyProcessor()
            layouts = tv_processor.get_all_layouts()
            layouts_json = json.dumps(layouts)
            
            # 7. Context 구성
            context = {
                "selected_does": doe_result,              # 템플릿용 (QuerySet)
                "selected_does_json": selected_does_json,  # JavaScript용 (JSON 문자열)
                "layouts_json": layouts_json,             # ✅ 추가: 차트 레이아웃
                "form": fitting_form,
                "color_filters": color_filters,
                "line_factors": line_factors,
                "deltav_baselines": deltav_baselines,
                "profile": profile,
                "tv_additions": tv_additions,
                "permission_level": permission_level,
                "hidden_columns_json": json.dumps(tv_additions.hidden_columns if tv_additions else []),
		        "hidden_rows_json": json.dumps(tv_additions.hidden_rows if tv_additions else []),
		        "column_order_json": json.dumps(tv_additions.column_order if tv_additions else []),
		        "reference_columns_json": json.dumps(tv_additions.reference_columns if tv_additions else []),
            }
            
            return render(request, "pao/compare_tv.html", context)
            


@login_required_hx
@require_http_methods(["POST"])
def tv_save_profile_does(request: HttpRequest, profile_id: int) -> JsonResponse:
    """Profile의 DOE 리스트 저장
    
    Args:
        request: HTTP POST 요청
        profile_id: 분석 프로필 ID
        
    Request Body:
        {
            "does": [11, 10, 9, 8, ...]  // DOE ID 리스트
        }
    
    Returns:
        JsonResponse: {
            "success": true,
            "added": [11, 9],      // 새로 추가된 DOE IDs
            "removed": [5, 6],     // 제거된 DOE IDs
            "current": [11, 10, 9, 8]  // 현재 DOE IDs
        }
    """
    try:
        # Profile 권한 확인
        profile = get_object_or_404(AnalysisProfile, id=profile_id, product_type="TV")
        
        try:
            profile_permission = AnalysisProfilePermission.objects.get(
                profile_id=profile_id, 
                user_id=request.user.id
            )
            if profile_permission.permission_level != "edit":
                return JsonResponse({
                    "success": False,
                    "error": "편집 권한이 없습니다."
                }, status=403)
        except AnalysisProfilePermission.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "프로필 접근 권한이 없습니다."
            }, status=403)
        
        # Request Body 파싱
        body = json.loads(request.body)
        new_doe_ids = set(body.get("does", []))
        
        # 현재 Profile의 DOE IDs
        current_doe_ids = set(profile.doe.values_list("id", flat=True))
        
        # 추가/제거할 DOE 계산
        to_add = new_doe_ids - current_doe_ids
        to_remove = current_doe_ids - new_doe_ids
        
        # DOE 추가
        if to_add:
            does_to_add = DOE.objects.filter(id__in=to_add, product_type="TV")
            for doe in does_to_add:
                ProfileDOE.objects.get_or_create(
                    analysis_profile=profile,
                    doe=doe
                )
        
        # DOE 제거
        if to_remove:
            ProfileDOE.objects.filter(
                analysis_profile=profile,
                doe_id__in=to_remove
            ).delete()
        
        return JsonResponse({
            "success": True,
            "added": list(to_add),
            "removed": list(to_remove),
            "current": list(new_doe_ids)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "error": "잘못된 JSON 형식입니다."
        }, status=400)
    except Exception as e:
        logger.error(f"Profile DOE 저장 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


@login_required_hx
@require_http_methods(["PATCH"])
def tv_save_additions(request: HttpRequest, profile_id: int) -> JsonResponse:
    try:
        # Profile 권한 확인
        profile = get_object_or_404(AnalysisProfile, id=profile_id, product_type="TV")
        
        try:
            profile_permission = AnalysisProfilePermission.objects.get(
                profile_id=profile_id, 
                user_id=request.user.id
            )
            if profile_permission.permission_level != "edit":
                return JsonResponse({
                    "success": False,
                    "error": "편집 권한이 없습니다."
                }, status=403)
        except AnalysisProfilePermission.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "프로필 접근 권한이 없습니다."
            }, status=403)
        
        # Request Body 파싱
        body = json.loads(request.body)
        color_filter_id = body.get("color_filter")
        line_factor_id = body.get("line_factor")
        aging_time = body.get("aging_time", 30)
        
        # ✨ 추가: 테이블 상태 필드들
        hidden_columns = body.get("hidden_columns")
        hidden_rows = body.get("hidden_rows")
        column_order = body.get("column_order")
        reference_columns = body.get("reference_columns")
        
        # TVAdditions 가져오기 또는 생성
        tv_additions, created = ProfileTVAdditions.objects.get_or_create(
            analysis_profile=profile,
            defaults={
                "created_user": request.user,
                "ip": get_client_ip(request)[0],
                "modified_by": request.user,
            }
        )
        
        # 필터 객체 가져오기
        color_filter = None
        line_factor = None
        
        if color_filter_id:
            try:
                color_filter = TVColorFilter.objects.get(id=color_filter_id)
            except TVColorFilter.DoesNotExist:
                return JsonResponse({
                    "success": False,
                    "error": f"Color Filter를 찾을 수 없습니다."
                }, status=404)
        
        if line_factor_id:
            try:
                line_factor = TVLineFactor.objects.get(id=line_factor_id)
            except TVLineFactor.DoesNotExist:
                return JsonResponse({
                    "success": False,
                    "error": f"Line Factor를 찾을 수 없습니다."
                }, status=404)
        
        # 기존 필드 업데이트
        tv_additions.color_filter = color_filter
        tv_additions.line_factor = line_factor
        tv_additions.aging_time = aging_time
        tv_additions.modified_by = request.user
        
        # ✨ 추가: 테이블 상태 업데이트 (전달된 경우에만)
        if hidden_columns is not None:
            tv_additions.hidden_columns = hidden_columns
        if hidden_rows is not None:
            tv_additions.hidden_rows = hidden_rows
        if column_order is not None:
            tv_additions.column_order = column_order
        if reference_columns is not None:
            tv_additions.reference_columns = reference_columns
        
        tv_additions.save()
        
        return JsonResponse({
            "success": True,
            "message": "설정이 저장되었습니다."
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "error": "잘못된 JSON 형식입니다."
        }, status=400)
    except Exception as e:
        logger.error(f"TVAdditions 저장 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)
        
        
            
def tv_get_valid_doe_or_redirect(request: HttpRequest) -> tuple[dict[str, list[models.Model]], HttpResponse | None]:
    try:
        tag, doe_result = get_selected_doe(request, prefetch_fields=["ivl_set", "angle_set", "lt_set"])
        match tag:
            case "warning":
                getattr(messages, tag)(request, doe_result)
                return None, redirect(reverse_lazy("pao:device_list"))
            case "success":
                grouped_does = tv_get_valid_does_grouped(doe_result)
                return grouped_does, None
    except Exception as e:
        logger.error(f"DOE 선택 또는 분류 오류: {str(e)}", exc_info=True)
        return None, redirect(reverse_lazy("pao:device_list"))
            
            
@cache_page(60 * 15)
def tv_get_ivl_table(request: HttpRequest) -> JsonResponse:
    """기본 IVL 평균 테이블 + 모든 테이블의 기본 구조"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return redirect_response

        # 모든 DOE ID 수집 (IVL, Angle, LT 모든 데이터셋에서)
        all_doe_ids = set()
        for dataset_type in ["ivl", "angle", "lt"]:
            doe_list = grouped_does.get(dataset_type, [])
            for doe in doe_list:
                all_doe_ids.add(doe.id)
        
        # DOE 라벨 생성 (정렬된 순서로)
        all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]
        
        if not all_doe_labels:
            return JsonResponse({
                "message": "분석할 데이터가 없습니다.",
                "level": "warning", 
                "table_data": [],
                "graph_data": {}
            })

        # 1) IVL 테이블 (실제 데이터 - IVL이 있는 DOE만)
        if grouped_does.get("ivl"):
            # ivl_labels = tv_get_ivl_labels(grouped_does["ivl"])
            ivl_table_data, spectrum_storage = tv_generate_ivl_table(grouped_does["ivl"], all_doe_labels)
        else:
            # IVL 데이터가 없으면 기본 구조만 생성 (공백으로)
            ivl_table_data = tv_generate_base_table("ivl", all_doe_labels, default_value="")
            spectrum_storage = {}
            # Count 항목들 추가 (공백으로)
            for count_key in ["J10 Count", "J100 Count"]:
                ivl_table_data[count_key] = {"fieldName": count_key}
                for label in all_doe_labels:
                    ivl_table_data[count_key][label] = ""

        # IVL 데이터가 있지만 일부 DOE만 있는 경우, 없는 DOE는 공백으로 변경
        if grouped_does.get("ivl"):
            ivl_doe_labels = [f"DOE-{doe.id}" for doe in grouped_does["ivl"]]
            missing_doe_labels = set(all_doe_labels) - set(ivl_doe_labels)
            
            # IVL 데이터가 없는 DOE는 모든 IVL 관련 row를 공백으로 변경
            ivl_headers = tv_get_row_header("ivl") + ["J10 Count", "J100 Count"]
            for header in ivl_headers:
                if header in ivl_table_data:
                    for missing_label in missing_doe_labels:
                        ivl_table_data[header][missing_label] = ""

        # 2) 다른 테이블들의 기본 구조 생성 (공백으로)
        ivl_color_base = tv_generate_base_table("ivl_color", all_doe_labels, default_value="")
        angle_base = tv_generate_base_table("angle", all_doe_labels, default_value="") 
        lt_base = tv_generate_base_table("lt", all_doe_labels, default_value="")

        return JsonResponse({
            "message": "선택하신 DOE 조건의 평균 데이터를 나타내었습니다.",
            "level": "success",
            "table_data": (
                list(ivl_table_data.values()) +
                list(ivl_color_base.values()) +
                list(angle_base.values()) +
                list(lt_base.values())
            ),
            "graph_data": {"spectrum_storage": spectrum_storage}
        })
    except Exception as e:
        logger.error(f"IVL 테이블 처리 오류: {e}", exc_info=True)
        return JsonResponse({
            "message": "IVL 데이터 오류",
            "level": "error", 
            "table_data": [],
            "graph_data": {}
        }, status=500)



@cache_page(60 * 15)
def tv_get_ivl_color_table(request: HttpRequest) -> JsonResponse:
    """IVL + Color 계산 테이블"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return redirect_response

        # 전체 DOE 라벨 수집
        all_doe_ids = set()
        for dataset_type in ["ivl", "angle", "lt"]:
            for doe in grouped_does.get(dataset_type, []):
                all_doe_ids.add(doe.id)
        all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]

        color_filter_label = request.GET.get("color_filter")
        line_factor_label = request.GET.get("line_factor")
        
        if not color_filter_label or not line_factor_label:
            return JsonResponse({
                "message": "color_filter와 line_factor는 필수입니다.",
                "level": "warning",
                "table_data": [],
                "graph_data": {}
            }, status=400)

        try:
            color_filter_obj = TVColorFilter.objects.get(label=color_filter_label).rgb_data
            line_factor_obj = TVLineFactor.objects.get(label=line_factor_label)
        except (TVColorFilter.DoesNotExist, TVLineFactor.DoesNotExist) as e:
            return JsonResponse({
                "message": f"필터 또는 팩터를 찾을 수 없습니다: {e}",
                "level": "warning",
                "table_data": [],
                "graph_data": {}
            }, status=404)

        analyzer = TVSpectrumAnalyzer(color_filter_obj)
        
        # 전체 DOE 라벨 전달
        table_data, graph_data = analyzer.generate_color_table(
            grouped_does["ivl"],  # IVL 데이터만 전달
            tv_get_ivl_labels(grouped_does["ivl"]) if grouped_does["ivl"] else {"J10": [], "J100": []},
            line_factor_obj,
            all_doe_labels  # 추가 파라미터
        )

        return JsonResponse({
            "message": "IVL+Color 데이터 적용",
            "level": "success",
            "table_data": list(table_data.values()),
            "graph_data": graph_data
        })
    except Exception as e:
        logger.error(f"IVL+Color 처리 오류: {e}", exc_info=True)
        return JsonResponse({
            "message": "IVL+Color 데이터 오류",
            "level": "error",
            "table_data": [],
            "graph_data": {}
        }, status=500)



@cache_page(60 * 15)
def tv_get_angle_table(request: HttpRequest) -> JsonResponse:
    """Angle 데이터 테이블"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return redirect_response

        # 전체 DOE 라벨 수집
        all_doe_ids = set()
        for dataset_type in ["ivl", "angle", "lt"]:
            for doe in grouped_does.get(dataset_type, []):
                all_doe_ids.add(doe.id)
        all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]

        angle_rows, angle_averages, angle_spectrum_averages = tv_generate_angle_table(
            [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
            all_doe_labels
        )

        return JsonResponse({
            "message": "Angle 데이터 적용",
            "level": "success",
            "table_data": list(angle_rows.values()),
            "graph_data": {
                "angle_averages": angle_averages
            }
        })
    except Exception as e:
        logger.error(f"Angle 데이터 처리 오류: {e}", exc_info=True)
        return JsonResponse({
            "message": "Angle 데이터 오류",
            "level": "error",
            "table_data": [],
            "graph_data": {}
        }, status=500)


@cache_page(60 * 15)
def tv_get_lt_table(request: HttpRequest) -> JsonResponse:
    """LT 데이터 테이블"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return redirect_response

        # 전체 DOE 라벨 수집
        all_doe_ids = set()
        for dataset_type in ["ivl", "angle", "lt"]:
            for doe in grouped_does.get(dataset_type, []):
                all_doe_ids.add(doe.id)
        all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]

        color_filter_label = request.GET.get("color_filter")
        aging_time = float(request.GET.get("aging_time", 30))

        if not color_filter_label:
            return JsonResponse({
                "message": "color_filter는 필수입니다.",
                "level": "warning",
                "table_data": [],
                "graph_data": {}
            }, status=400)

        try:
            color_filter_obj = TVColorFilter.objects.get(label=color_filter_label).rgb_data
        except TVColorFilter.DoesNotExist:
            return JsonResponse({
                "message": f"Color Filter [{color_filter_label}] 없음",
                "level": "warning",
                "table_data": [],
                "graph_data": {}
            }, status=404)

        lt_rows, lt_graph_data, time_averages = tv_generate_lt_table(
            [lt for doe in grouped_does["lt"] for lt in doe.lt_set.all()],
            color_filter_obj,
            aging_time,
            all_doe_labels
        )

        return JsonResponse({
            "message": "LT 데이터 적용",
            "level": "success",
            "table_data": list(lt_rows.values()),
            "graph_data": {"lt": lt_graph_data, "time_averages": time_averages}
        })
    except Exception as e:
        logger.error(f"LT 데이터 처리 오류: {e}", exc_info=True)
        return JsonResponse({
            "message": "LT 데이터 오류",
            "level": "error",
            "table_data": [],
            "graph_data": {}
        }, status=500)
        


def tv_colorfilter_edit(request: HttpRequest) -> HttpResponse:
    if request.method == "POST" and request.GET.get("delete"):
        delete_id = request.GET.get("delete")
        try:
            obj = TVColorFilter.objects.get(id=delete_id)
            
            # ✨ 추가: 권한 검증
            if obj.created_user != request.user:
                messages.error(request, "삭제 권한이 없습니다.")
                return redirect("pao:tv_colorfilter_edit")
            
            obj.delete()
            messages.success(request, "Color Filter가 삭제되었습니다.")
        except TVColorFilter.DoesNotExist:
            messages.warning(request, "삭제할 항목이 없습니다.")
        except Exception as e:
            logger.error(f"ColorFilter 삭제 오류: {str(e)}", exc_info=True)
            messages.error(request, "삭제 중 오류가 발생했습니다.")
        return redirect("pao:tv_colorfilter_edit")

    elif request.method == "POST" and "csv_file" in request.FILES:
        label = request.POST.get("label")
        file = request.FILES["csv_file"]

        try:
            # ✨ 변경: request 파라미터 추가
            success, msg = tv_process_color_filter_upload(label, file, request)
            if success:
                messages.success(request, msg)
            else:
                messages.warning(request, msg)
        except ValueError as ve:
            logger.warning(f"업로드 값 오류: {str(ve)}")
            messages.error(request, "입력값 오류: " + str(ve))
        except Exception as e:
            logger.error(f"ColorFilter 업로드 중 예외 발생: {str(e)}", exc_info=True)
            messages.error(request, "업로드 중 오류가 발생했습니다.")
        return redirect("pao:tv_colorfilter_edit")

    else:
        colorfilters = TVColorFilter.objects.all().order_by("label")
        return render(request, "pao/tv_colorfilter_edit.html", {"colorfilters": colorfilters})

def tv_linefactor_edit(request: HttpRequest) -> HttpResponse:
    edit_id = request.GET.get("edit")
    edit_instance = None
    is_edit_mode = False
    
    if edit_id:
        try:
            edit_instance = TVLineFactor.objects.get(id=edit_id)
            if not (edit_instance.created_user == request.user or request.user.is_staff):
                messages.error(request, "수정 권한이 없습니다.")
                return redirect("pao:tv_linefactor_edit")
            is_edit_mode = True
        except TVLineFactor.DoesNotExist:
            messages.warning(request, "수정할 항목이 없습니다.")
            return redirect("pao:tv_linefactor_edit")
    
    if request.method == "POST":
        delete_id = request.GET.get("delete")
        if delete_id:
            try:
                obj = TVLineFactor.objects.get(id=delete_id)
                
                if not (obj.created_user == request.user or request.user.is_staff):
                    messages.error(request, "삭제 권한이 없습니다.")
                    return redirect("pao:tv_linefactor_edit")
                
                label = obj.label
                obj.delete()
                messages.success(request, f"{label}가 삭제되었습니다.")
            except TVLineFactor.DoesNotExist:
                messages.warning(request, "삭제할 Line Factor가 없습니다.")
            except Exception as e:
                logger.error(f"LineFactor 삭제 오류: {str(e)}", exc_info=True)
                messages.error(request, "삭제 중 오류가 발생했습니다.")
            return redirect("pao:tv_linefactor_edit")

        # ✨ 변경: is_edit_mode와 request 전달
        form = TVLineFactorForm(
            request.POST, 
            instance=edit_instance,
            is_edit_mode=is_edit_mode,
            request=request
        )
        
        if form.is_valid():
            try:
                instance = form.save(commit=False)
                instance.created_user = request.user
                instance.ip = get_client_ip(request)[0]
                instance.save()
                
                action = "수정" if edit_instance else "등록"
                messages.success(request, f"{form.cleaned_data['label']} {action} 완료!")
            except Exception as e:
                logger.error(f"LineFactor 저장 오류: {str(e)}", exc_info=True)
                messages.error(request, "저장 중 오류가 발생했습니다.")
            return redirect("pao:tv_linefactor_edit")
        else:
            logger.warning(f"LineFactor 입력 오류: {form.errors.as_json()}")
            messages.error(request, "입력값을 확인해주세요.")
    else:
        # ✨ 변경: is_edit_mode와 request 전달
        form = TVLineFactorForm(
            instance=edit_instance,
            is_edit_mode=is_edit_mode,
            request=request
        )

    try:
        line_factors = TVLineFactor.objects.all().order_by("label")
    except Exception as e:
        logger.error(f"LineFactor 조회 오류: {str(e)}", exc_info=True)
        messages.error(request, "Line Factor 목록을 불러오는 중 오류가 발생했습니다.")
        line_factors = []

    return render(request, "pao/tv_linefactor_edit.html", {
        "form": form,
        "line_factors": line_factors,
        "fields": [form[field] for field in form.Meta.LINEFACTOR_FIELDS],
        "is_edit_mode": is_edit_mode,
        "edit_instance": edit_instance,
    })
    
@cache_page(60 * 5)
def tv_get_graph_options(request: HttpRequest) -> JsonResponse:
    """그래프 X/Y축 선택 옵션 반환"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return JsonResponse({"error": "DOE 선택 오류"}, status=400)

        graph_options = {
            "x_axis_options": [
                {"value": "doe_id", "label": "DOE ID", "category": "기본"},
                {"value": "wavelength", "label": "Wavelength (nm)", "category": "스펙트럼"},
                {"value": "angle", "label": "Angle (degree)", "category": "각도"},
                {"value": "delta_u", "label": "Δu'", "category": "각도"},
                {"value": "time", "label": "Time (hour)", "category": "시간"},
            ],
            "y_axis_options": [
                # IVL 관련
                {"value": "J10-V(volt)", "label": "J10 Voltage (V)", "category": "IVL"},
                {"value": "J10-CE(cd/A)", "label": "J10 Current Efficiency", "category": "IVL"},
                {"value": "J10-n(QE)", "label": "J10 Quantum Efficiency", "category": "IVL"},
                {"value": "J10-x", "label": "J10 CIE x", "category": "IVL"},
                {"value": "J10-y", "label": "J10 CIE y", "category": "IVL"},
                {"value": "J100-V(volt)", "label": "J100 Voltage (V)", "category": "IVL"},
                
                # Color 관련
                {"value": "R_x", "label": "Red x", "category": "Color"},
                {"value": "R_y", "label": "Red y", "category": "Color"},
                {"value": "R_eff", "label": "Red Efficiency", "category": "Color"},
                {"value": "G_x", "label": "Green x", "category": "Color"},
                {"value": "G_y", "label": "Green y", "category": "Color"},
                {"value": "G_eff", "label": "Green Efficiency", "category": "Color"},
                {"value": "B_x", "label": "Blue x", "category": "Color"},
                {"value": "B_y", "label": "Blue y", "category": "Color"},
                {"value": "B_eff", "label": "Blue Efficiency", "category": "Color"},
                {"value": "W_x", "label": "White x", "category": "Color"},
                {"value": "W_y", "label": "White y", "category": "Color"},
                {"value": "W_eff", "label": "White Efficiency", "category": "Color"},
                
                # 색역 overlap_ratio 3개 추가
                {"value": "sRGB-overlap_ratio", "label": "sRGB Overlap Ratio", "category": "Color"},
                {"value": "DCI-P3-overlap_ratio", "label": "DCI-P3 Overlap Ratio", "category": "Color"},
                {"value": "BT.2020-overlap_ratio", "label": "BT.2020 Overlap Ratio", "category": "Color"},
                
                # Spectrum 관련
                {"value": "Spec-B Peak", "label": "Blue Peak", "category": "스펙트럼"},
                {"value": "Spec-YG Peak", "label": "Yellow-Green Peak", "category": "스펙트럼"},
                
                # Angle 관련
                {"value": "Angle-Δu'v'(60°)", "label": "Δu'v' at 60°", "category": "각도"},
                
                # LT 관련 (수정된 부분)
                {"value": "T95-W", "label": "T95 White", "category": "LT"},
                {"value": "T95-R", "label": "T95 Red", "category": "LT"},
                {"value": "T95-G", "label": "T95 Green", "category": "LT"},
                {"value": "T95-B", "label": "T95 Blue", "category": "LT"},
                {"value": "T95-Bpeak", "label": "T95 Blue Peak", "category": "LT"},
                {"value": "ΔV(T95-G)", "label": "ΔV at T95 Green", "category": "LT"},  # 수정됨
            ],
            "chart_types": [
                {"value": "scatter", "label": "산점도"},
                {"value": "line", "label": "선 그래프"},
                {"value": "bar", "label": "막대 그래프"},
            ]
        }

        return JsonResponse({"success": True, "options": graph_options})

    except Exception as e:
        logger.error(f"그래프 옵션 조회 오류: {e}", exc_info=True)
        return JsonResponse({"error": "옵션 조회 실패"}, status=500)
        


def tv_get_dynamic_graph_data(request: HttpRequest) -> JsonResponse:
    """선택된 X/Y축에 따른 그래프 데이터 반환"""
    grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
    if redirect_response:
        return JsonResponse({"error": "DOE 선택 오류"}, status=400)

    x_field = request.GET.get("x_axis")
    y_field = request.GET.get("y_axis") 
    y2_field = request.GET.get("y2_axis", "")
    chart_type = request.GET.get("chart_type", "scatter")
    # ✨ 변경: label → id
    color_filter_id = request.GET.get("color_filter", "")
    line_factor_id = request.GET.get("line_factor", "")

    selected_columns = request.GET.get("selected_columns", "")
    selected_columns_list = selected_columns.split(",") if selected_columns else []
    
    if not x_field or not y_field:
        return JsonResponse({"error": "X축, Y축을 선택해주세요."}, status=400)
    
    graph_data = tv_collect_graph_data_from_tables(
        grouped_does, x_field, y_field, y2_field, color_filter_id, line_factor_id, selected_columns_list
    )

    return JsonResponse({
        "success": True,
        "data": graph_data,
        "config": {
            "x_field": x_field,
            "y_field": y_field, 
            "y2_field": y2_field,
            "chart_type": chart_type
        }
    })


def tv_collect_graph_data_from_tables(grouped_does, x_field, y_field, y2_field, color_filter_id, line_factor_id, selected_columns_list=None):
    graph_data = {"traces": []}
    
    # 전체 DOE 라벨 수집
    all_doe_ids = set()
    for dataset_type in ["ivl", "angle", "lt"]:
        for doe in grouped_does.get(dataset_type, []):
            all_doe_ids.add(doe.id)
    all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]
    
    selected_doe_labels = [label for label in all_doe_labels if label in selected_columns_list] if selected_columns_list else all_doe_labels
    
    # ===== 필요한 데이터를 미리 생성 (조건부) =====
    ivl_data = None
    angle_data = None
    lt_data = None
    table_data_combined = {}
    
    # IVL 데이터가 필요한 경우만 생성
    if x_field in ["wavelength", "doe_id"] and grouped_does.get("ivl"):
        ivl_table_data, spectrum_storage = tv_generate_ivl_table(
            grouped_does["ivl"], 
            selected_doe_labels
        )
        ivl_data = {"table": ivl_table_data, "spectrum": spectrum_storage}
        if x_field == "doe_id":
            table_data_combined.update(ivl_table_data)
    
    # Color 데이터가 필요한 경우만 생성
    # ✨ 변경: label → id로 조회
    if x_field == "doe_id" and color_filter_id and line_factor_id and grouped_does.get("ivl"):
        try:
            color_filter_obj = TVColorFilter.objects.get(id=color_filter_id).rgb_data
            line_factor_obj = TVLineFactor.objects.get(id=line_factor_id)
            analyzer = TVSpectrumAnalyzer(color_filter_obj)
            color_table_data, _ = analyzer.generate_color_table(
                grouped_does["ivl"], 
                line_factor_obj, 
                selected_doe_labels
            )
            table_data_combined.update(color_table_data)
        except (TVColorFilter.DoesNotExist, TVLineFactor.DoesNotExist):
            pass
    
    # Angle 데이터가 필요한 경우만 생성
    if x_field in ["wavelength", "angle", "delta_u", "doe_id"] and grouped_does.get("angle"):
        angle_rows, angle_averages, angle_spectrum_averages = tv_generate_angle_table(
            [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
            selected_doe_labels
        )
        angle_data = {"rows": angle_rows, "averages": angle_averages, "spectrum": angle_spectrum_averages}
        if x_field == "doe_id":
            table_data_combined.update(angle_rows)
    
    # LT 데이터가 필요한 경우만 생성
    # ✨ 변경: label → id로 조회
    if x_field in ["time", "doe_id"] and grouped_does.get("lt") and color_filter_id:
        try:
            color_filter_obj = TVColorFilter.objects.get(id=color_filter_id).rgb_data
            lt_rows, lt_graph_data = tv_generate_lt_table(
                [lt for doe in grouped_does["lt"] for lt in doe.lt_set.all()],
                color_filter_obj, 30.0
            )
            lt_data = {"rows": lt_rows, "graph": lt_graph_data}
            if x_field == "doe_id":
                table_data_combined.update(lt_rows)
        except TVColorFilter.DoesNotExist:
            pass
    
    if x_field == "wavelength":
        if y_field == "j10_spectrum_intensity" and ivl_data:
            # J10 스펙트럼 처리
            if not grouped_does.get("ivl"):
                return graph_data
                
            # J10 스펙트럼 평균 계산
            spectrum_averages = calculate_spectrum_averages(ivl_data["spectrum"], selected_doe_labels)
            
            # 선택된 DOE만 그래프 데이터 생성
            for doe_label in selected_doe_labels:
                if doe_label in spectrum_averages:
                    trace_data = {
                        "x": spectrum_averages[doe_label]["wavelength"],
                        "y": spectrum_averages[doe_label]["intensity"],
                        "name": f"{doe_label} - J10 Spectrum",
                        "type": "scatter",
                        "mode": "lines"
                    }
                    graph_data["traces"].append(trace_data)
        
        elif y_field == "angular_spectrum_intensity" and angle_data:
            # Angular 스펙트럼 처리
            if not grouped_does.get("angle"):
                return graph_data
                
            # 선택된 DOE만 그래프 데이터 생성
            for doe_label in selected_doe_labels:
                if doe_label in angle_data["spectrum"]:
                    for angle, spectrum_data in angle_data["spectrum"][doe_label].items():
                        trace_data = {
                            "x": spectrum_data["wavelength"],
                            "y": spectrum_data["intensity"],
                            "name": f"{doe_label} - {angle}°",
                            "type": "scatter",
                            "mode": "lines",
                            "angle": angle  # 각도 정보 추가 (필터링용)
                        }
                        graph_data["traces"].append(trace_data)
    
    elif x_field == "time" and lt_data:
	    # LT 시간 그래프 데이터 처리
	    if not grouped_does.get("lt") or not color_filter:
	        return graph_data
	        
	    # Y축 필드와 lt_graph_data 키 매핑
	    y_data_map = {
	        "white_intensity": "white",
	        "red_intensity": "red", 
	        "green_intensity": "green",
	        "blue_intensity": "blue",
	        "blue_peak_intensity": "blue_peak",
	        "vdelta": "vdelta"
	    }
	    
	    # Y축 데이터 처리
	    y_metric = y_data_map.get(y_field)
	    y2_metric = y_data_map.get(y2_field) if y2_field else None
	    
	    if y_metric:
	        # 선택된 DOE만 처리
	        for doe_label in selected_doe_labels:
	            if doe_label in lt_data["graph"]:
	                doe_data = lt_data["graph"][doe_label]
	                
	                # 공통 time과 각 메트릭의 values 사용
	                time_values = doe_data.get("time", [])
	                y_values = doe_data.get(y_metric, [])  # 직접 배열 접근
	                
	                if not y_values:
	                    continue
	                    
	                # 기본 trace 데이터
	                trace_data = {
	                    "x": time_values,
	                    "y": y_values,
	                    "name": f"{doe_label} - {y_field}",
	                    "type": "scatter",
	                    "mode": "lines"
	                }
	                
	                # Y2축 데이터 추가 (있는 경우)
	                if y2_metric and y2_field:
	                    y2_values = doe_data.get(y2_metric, [])
	                    
	                    if y2_values:
	                        trace_y2 = {
	                            "x": time_values,
	                            "y": y2_values,
	                            "name": f"{doe_label} - {y2_field}",
	                            "type": "scatter",
	                            "mode": "lines", 
	                            "yaxis": "y2",
	                        }
	                        graph_data["traces"].append(trace_y2)
	                
	                graph_data["traces"].append(trace_data)
	        
	        # Y2축이 있는 경우 layout 정보 추가
	        if y2_field and any(trace.get("yaxis") == "y2" for trace in graph_data["traces"]):
	            graph_data["layout_config"] = {
	                "yaxis2": {
	                    "title": y2_field,
	                    "overlaying": "y",
	                    "side": "right"
	                }
	            }
    
	elif x_field == "angle" and angle_data:
	    # 각도 그래프 데이터 처리
	    if not grouped_does.get("angle"):
	        return graph_data
	        
	    angle_averages = angle_data["averages"]
	        
	    # Y축에 따른 데이터 선택
	    if y_field == "delta_uv":
	        # 선택된 DOE만 처리
	        for doe_label in selected_doe_labels:
	            if doe_label in angle_averages:
	                trace_data = {
	                    "x": angle_averages[doe_label]["angle"],
	                    "y": angle_averages[doe_label]["delta_uv"],
	                    "name": doe_label,
	                    "type": "scatter",
	                    "mode": "lines"
	                }
	                graph_data["traces"].append(trace_data)
                    
    elif x_field == "delta_u" and angle_data:
        # deltau' 그래프 데이터 처리
        if not grouped_does.get("angle"):
            return graph_data
        
        uv_averages = calculate_angle_uv_components(
            [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
            all_doe_labels
        )
        
        # 선택된 DOE만 처리
        for doe_label in selected_doe_labels:
            if doe_label in uv_averages:
                trace_data = {
                    "x": uv_averages[doe_label]["delta_u"],
                    "y": uv_averages[doe_label]["delta_v"],
                    "name": doe_label,
                    "type": "scatter",
                    "mode": "lines+markers"
                }
                graph_data["traces"].append(trace_data)
    
    elif x_field == "doe_id":
        # 기존 DOE 비교 로직
        lt_field_map = {
			"white_intensity": "T95-W",
			"red_intensity": "T95-R",
			"green_intensity": "T95-G",
			"blue_intensity": "T95-B",
			"blue_peak_intensity": "T95-Bpeak",
			"vdelta": "ΔV(T95-G)",
        }
        
        
        # 2) 선택된 DOE만 그래프 데이터 생성
        selected_doe_ids = [int(label.replace("DOE-", "")) for label in selected_doe_labels]
        doe_ids, y_values, y2_values = [], [], []
        mapped_y_field = lt_field_map.get(y_field, y_field)
        mapped_y2_field = lt_field_map.get(y2_field, y2_field) if y2_field else None
        
        for doe_id in sorted(selected_doe_ids):
            doe_label = f"DOE-{doe_id}"
            
            if mapped_y_field in table_data_combined:
                y_val = table_data_combined[mapped_y_field].get(doe_label, "-")
                if y_val not in ["-", "", None]:
                    try:
                        clean_val = str(y_val).replace("(예측)", "").strip()
                        doe_ids.append(doe_id)
                        y_values.append(float(clean_val))
                        
                        # Y2 데이터 수집
                        if mapped_y2_field and mapped_y2_field in table_data_combined:
                            y2_val = table_data_combined[mapped_y2_field].get(doe_label, "-")
                            if y2_val not in ["-", "", None]:
                                try:
                                    clean_y2_val = str(y2_val).replace("(예측)", "").strip()
                                    y2_values.append(float(clean_y2_val))
                                except:
                                    y2_values.append(None)
                            else:
                                y2_values.append(None)
                    except:
                        continue
        
        # Y축 trace 생성
        if doe_ids:
            trace_data = {
                "x": doe_ids,
                "y": y_values,
                "name": f"DOE Comparison - {mapped_y_field}"
            }
            graph_data["traces"].append(trace_data)
            
            # Y2축 trace 별도 생성
            if mapped_y2_field and y2_values and any(v is not None for v in y2_values):
                trace_y2 = {
                    "x": doe_ids,
                    "y": y2_values,
                    "name": f"DOE Comparison - {mapped_y2_field}",
                    "yaxis": "y2"
                }
                graph_data["traces"].append(trace_y2)
    
    return graph_data
    

def tv_gamut_analysis(request: HttpRequest) -> HttpResponse:
    """색역분석 새창 페이지"""
    context = {
        'page_title': '색역분석',
    }
    return render(request, 'pao/tv_gamut_analysis.html', context)
    

@cache_page(60 * 15)
def tv_get_chart_data(request: HttpRequest) -> JsonResponse:
    """TV 분석용 고정 차트 10개 데이터 반환"""
    try:
        grouped_does, redirect_response = tv_get_valid_doe_or_redirect(request)
        if redirect_response:
            return redirect_response

        # 전체 DOE 라벨 수집
        all_doe_ids = set()
        for dataset_type in ["ivl", "angle", "lt"]:
            for doe in grouped_does.get(dataset_type, []):
                all_doe_ids.add(doe.id)
        all_doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(all_doe_ids)]

        # ✨ 변경: label → id
        color_filter_id = request.GET.get("color_filter")
        line_factor_id = request.GET.get("line_factor")
        aging_time = float(request.GET.get("aging_time", 30))
        
        selected_columns = request.GET.get("selected_columns", "")
        selected_columns_list = selected_columns.split(",") if selected_columns else []
        
        if selected_columns:
            selected_doe_labels = [label for label in all_doe_labels if label in selected_columns_list]
        else:
            selected_doe_labels = all_doe_labels

        # 기본 차트 데이터 생성
        chart_data = {}
        
        # IVL 기반 차트들 (1-4번)
        if grouped_does.get("ivl"):
            # 1. J-V 차트
            chart_data["jv_chart"] = generate_jv_chart_data(
                grouped_does["ivl"], 
                selected_doe_labels
            )
            
            # 2. cd/A-J 차트
            chart_data["cj_chart"] = generate_cj_chart_data(
                grouped_does["ivl"], 
                selected_doe_labels
            )
            
            # 3. Spectrum 차트
            _, spectrum_storage = tv_generate_ivl_table(
                grouped_does["ivl"], 
                selected_doe_labels
            )
            chart_data["spectrum_chart"] = generate_spectrum_chart_data(
                spectrum_storage, 
                selected_doe_labels
            )

        # Angle 기반 차트들
        if grouped_does.get("angle"):
            _, angle_averages, _ = tv_generate_angle_table(
                [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
                selected_doe_labels
            )
            
            chart_data["angular_spectrum_chart"] = generate_angular_spectrum_chart_data(
                [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
                selected_doe_labels  
            )
            
            chart_data["delta_uv_angle_chart"] = generate_delta_uv_angle_chart_data(
                angle_averages, 
                selected_doe_labels
            )
            
            chart_data["delta_u_delta_v_chart"] = generate_delta_u_delta_v_chart_data(
                [angle for doe in grouped_does["angle"] for angle in doe.angle_set.all()],
                selected_doe_labels
            )

        # LT 기반 차트들
        # ✨ 변경: label → id로 조회
        if grouped_does.get("lt") and color_filter_id:
            try:
                color_filter_obj = TVColorFilter.objects.get(id=color_filter_id).rgb_data
                _, lt_graph_data = tv_generate_lt_table(
                    [lt for doe in grouped_does["lt"] for lt in doe.lt_set.all()],
                    color_filter_obj, 
                    aging_time, 
                )
                
                chart_data["lt_chart"] = generate_lt_chart_data(
                    lt_graph_data, 
                    selected_doe_labels
                )
                
                chart_data["delta_v_chart"] = generate_delta_v_chart_data(
                    lt_graph_data, 
                    selected_doe_labels
                )
                
            except TVColorFilter.DoesNotExist:
                chart_data["lt_chart"] = {"traces": []}
                chart_data["delta_v_chart"] = {"traces": []}

        # Color 기반 차트
        # ✨ 변경: label → id로 조회
        if grouped_does.get("ivl") and color_filter_id and line_factor_id:
            try:
                color_filter_obj = TVColorFilter.objects.get(id=color_filter_id).rgb_data
                line_factor_obj = TVLineFactor.objects.get(id=line_factor_id)
                analyzer = TVSpectrumAnalyzer(color_filter_obj)
                
                color_table_data, _ = analyzer.generate_color_table(
                    grouped_does["ivl"], 
                    line_factor_obj, 
                    selected_doe_labels
                )
                
                chart_data["wxy_chart"] = generate_wxy_chart_data(
                    grouped_does["ivl"], 
                    selected_doe_labels,
                    color_filter_obj,
                    line_factor_obj
                )
                
                chart_data["color_coordinate_chart"] = generate_color_coordinate_chart_data(
                    color_table_data, 
                    selected_doe_labels
                )
                
            except (TVColorFilter.DoesNotExist, TVLineFactor.DoesNotExist):
                chart_data["color_coordinate_chart"] = {"traces": []}
                chart_data["wxy_chart"] = {"traces": []}
                
        tv_processor = TVPlotlyProcessor()
        layouts = tv_processor.get_all_layouts()

        return JsonResponse({
            "success": True,
            "chart_data": chart_data,
            "layouts": layouts,
            "message": f"{len(selected_doe_labels)}개 DOE 차트 데이터 생성 완료"
        })

    except Exception as e:
        logger.error(f"TV 차트 데이터 생성 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": "차트 데이터 생성 실패",
            "chart_data": {}
        }, status=500)
        
        

def tv_deltav_baseline_edit(request: HttpRequest) -> HttpResponse:
    """Delta V 기준선 편집 페이지"""
    if request.method == "POST" and request.GET.get("delete"):
        delete_id = request.GET.get("delete")
        try:
            obj = TVDeltaVBaseline.objects.get(id=delete_id)
            
            # ✨ 변경: is_staff 추가
            if not (obj.created_user == request.user or request.user.is_staff):
                messages.error(request, "삭제 권한이 없습니다.")
                return redirect("pao:tv_deltav_baseline_edit")
            
            label = obj.label
            obj.delete()
            messages.success(request, f"{label} 기준선이 삭제되었습니다.")
        except TVDeltaVBaseline.DoesNotExist:
            messages.warning(request, "삭제할 항목이 없습니다.")
        except Exception as e:
            logger.error(f"기준선 삭제 오류: {str(e)}", exc_info=True)
            messages.error(request, "삭제 중 오류가 발생했습니다.")
        return redirect("pao:tv_deltav_baseline_edit")

    elif request.method == "POST" and "baseline_file" in request.FILES:
        label = request.POST.get("label")
        file = request.FILES["baseline_file"]

        try:
            success, msg = tv_process_deltav_baseline_upload(label, file, request)
            if success:
                messages.success(request, msg)
            else:
                messages.warning(request, msg)
        except ValueError as ve:
            logger.warning(f"업로드 값 오류: {str(ve)}")
            messages.error(request, "입력값 오류: " + str(ve))
        except Exception as e:
            logger.error(f"기준선 업로드 중 예외 발생: {str(e)}", exc_info=True)
            messages.error(request, "업로드 중 오류가 발생했습니다.")
        return redirect("pao:tv_deltav_baseline_edit")

    else:
        baselines = TVDeltaVBaseline.objects.select_related('created_user').all().order_by("label")
        return render(request, "pao/tv_deltav_baseline_edit.html", {"baselines": baselines})
        
def tv_get_deltav_baselines(request: HttpRequest) -> JsonResponse:
    """Delta V 기준선 목록 반환"""
    try:
         # ✨ select_related 추가로 N+1 쿼리 방지
        baselines = TVDeltaVBaseline.objects.select_related('created_user').all().order_by("label")
        
        baseline_list = []
        for b in baselines:
            # ✨ created_user가 None일 경우 대비 + 중첩 객체 구조로 변경
            baseline_list.append({
                "id": b.id,
                "label": b.label,
                "created_user": {
                    "full_name": b.created_user.full_name if b.created_user else "Unknown"
                }
            })
        
        return JsonResponse({
            "success": True,
            "baselines": baseline_list
        })
    except Exception as e:
        logger.error(f"기준선 목록 조회 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)


def tv_get_deltav_baseline_data(request: HttpRequest) -> JsonResponse:
    """특정 기준선 데이터 반환"""
    try:
        # ✨ 변경: label → baseline_id
        baseline_id = request.GET.get("baseline_id")
        
        if not baseline_id:
            return JsonResponse({
                "success": False,
                "error": "baseline_id 파라미터가 필요합니다."
            }, status=400)
        
        # ✨ 변경: label → id로 조회
        baseline = TVDeltaVBaseline.objects.get(id=baseline_id)
        
        # JSON 데이터를 리스트로 변환
        times = []
        delta_vs = []
        for time_str, delta_v in sorted(baseline.baseline_data.items(), key=lambda x: float(x[0])):
            times.append(float(time_str))
            delta_vs.append(delta_v)
        
        return JsonResponse({
            "success": True,
            "id": baseline.id,  # ✨ 추가
            "label": baseline.label,
            "times": times,
            "delta_vs": delta_vs
        })
    except TVDeltaVBaseline.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "기준선을 찾을 수 없습니다."
        }, status=404)
    except Exception as e:
        logger.error(f"기준선 데이터 조회 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)
        
        
        
@require_GET
def doe_angle_charts(request: HttpRequest) -> JsonResponse:
    """단일 DOE의 angle 차트 데이터 반환"""
    try:
        doe_id = request.GET.get("doe_id")
        if not doe_id:
            return JsonResponse({
                "success": False,
                "data": {
                    "tag": "error",
                    "message": "doe_id 파라미터가 필요합니다."
                }
            }, status=400)
        
        doe = DOE.objects.get(id=doe_id)
        angles = doe.angle_set.all()
        
        if not angles.exists():
            return JsonResponse({
                "success": False,
                "data": {
                    "tag": "warning",
                    "message": "Angle 데이터가 없습니다."
                }
            })
        
        angle_spectrum_traces = []
        delta_uv_angle_traces = []
        
        for angle in angles:  # ✨ 수정: idx 제거, angle 객체 직접 사용
            expt = angle.expt
            expt_spec = angle.expt_spec
            
            if not expt or not expt_spec:
                continue
            
            # angle_id 가져오기
            angle_id = angle.angle_id  # ✨ 또는 angle.angle_id (필드명에 따라)
            
            # 6번: u'v' 좌표 계산
            uv_by_angle = {}
            for entry in expt:
                try:
                    filename = entry.get("filename", "")
                    degree = int(filename.split("(")[-1].replace(")", ""))
                    x, y = float(entry.get("x", 0)), float(entry.get("y", 0))
                    u, v = TVSpectrumAnalyzer.xy_to_uv(x, y)
                    uv_by_angle[degree] = (u, v)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Angle 데이터 파싱 오류: {e}")
                    continue
            
            if 0 not in uv_by_angle:
                continue
            
            # 6번: Delta u'v' 계산
            u0, v0 = uv_by_angle[0]
            angles_list = []
            delta_uv_list = []
            
            for deg in sorted(uv_by_angle.keys()):
                u, v = uv_by_angle[deg]
                delta = round(((u - u0) ** 2 + (v - v0) ** 2) ** 0.5, 5)
                angles_list.append(deg)
                delta_uv_list.append(delta)
            
            delta_uv_angle_traces.append({
                "x": angles_list,
                "y": delta_uv_list,
                "name": f"Angle ID: {angle_id}",  # ✨ 수정: angle_id 사용
                "type": "scatter",
                "mode": "lines+markers"
            })
            
            # 5번: Angular Spectrum
            for entry, spec in zip(expt, expt_spec):
                try:
                    filename = entry.get("filename", "")
                    degree = int(filename.split("(")[-1].replace(")", ""))
                    
                    spectrum_dict = None
                    if isinstance(spec, dict):
                        first_key = next(iter(spec.keys()))
                        spectrum_dict = spec[first_key]
                    
                    if spectrum_dict and isinstance(spectrum_dict, dict):
                        wavelengths = sorted([float(wl) for wl in spectrum_dict.keys() 
                                            if str(wl).replace(".", "").isdigit()], key=float)
                        intensities = [float(spectrum_dict[str(wl)]) for wl in wavelengths]
                        
                        angle_spectrum_traces.append({
                            "x": wavelengths,
                            "y": intensities,
                            "name": f"ID{angle_id}_{degree}°",  # ✨ 수정: angle_id 사용
                            "type": "scatter",
                            "mode": "lines"
                        })
                        
                except (ValueError, KeyError) as e:
                    logger.warning(f"Spectrum 데이터 파싱 오류: {e}")
                    continue
        
        return JsonResponse({
            "success": True,
            "data": {
                "tag": "success",
                "angle_spectrum_data": angle_spectrum_traces,
                "delta_uv_angle_data": delta_uv_angle_traces
            }
        })
        
    except DOE.DoesNotExist:
        return JsonResponse({
            "success": False,
            "data": {
                "tag": "error",
                "message": "DOE를 찾을 수 없습니다."
            }
        }, status=404)
    except Exception as e:
        logger.error(f"Angle 차트 데이터 생성 오류: {e}", exc_info=True)
        return JsonResponse({
            "success": False,
            "data": {
                "tag": "error",
                "message": f"차트 생성 중 오류: {str(e)}"
            }
        }, status=500)
        
        
def pao_guide(request):
	return render(request, "pao/pao_guide.html")
	
	
@login_required_hx
def tv_colorfilter_list(request):
    """Color Filter 목록 반환"""
    filters = TVColorFilter.objects.all().values('id', 'label')
    return JsonResponse(list(filters), safe=False)


@login_required_hx
def tv_linefactor_list(request):
    """Line Factor 목록 반환"""
    factors = TVLineFactor.objects.all().values('id', 'label')
    return JsonResponse(list(factors), safe=False)