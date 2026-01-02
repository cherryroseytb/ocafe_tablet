from collections import defaultdict
from django.db.models import Q, Count, Prefetch
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.views.generic import ListView, DetailView
from django.shortcuts import get_object_or_404, render, get_list_or_404
from dvmt.models import (
    Material, Sample, FittingResult, AC3Meas, EllipsometerMeas, PLMeas,
    PLQYMeas, UVVISMeas, LTPLMeas, TRPLMeas, CVMeas, IVMeas, ManualFile
)
from dvmt.detail import (
    get_pl_data, pl_chart, get_plqy_data, plqy_chart,
    get_uvvis_data, uvvis_chart, get_ac3_data, ac3_chart,
    get_ellipsometer_data, ellipsometer_chart,
    get_cv_data, cv_chart, get_iv_data, iv_chart,
    get_trpl_data, trpl_chart, get_ltpl_data, ltpl_chart
)
import json

def format_value(val, precision="{:.2f}"):
    if val is None:
        return "-"
    if isinstance(val, (int, float)) and int(val) == 9999:
        return "측정불가"
    return precision.format(val)

class MeasListView(LoginRequiredMixin, ListView):
    template_name = 'dvmt/meas_list.html'
    context_object_name = 'materials'
    model = Sample
    paginate_by = 10

    equip_model_map = {
        'uvvis': UVVISMeas, 'ac3': AC3Meas, 'ellipso': EllipsometerMeas,
        'pl': PLMeas, 'plqy': PLQYMeas, 'trpl': TRPLMeas,
        'ltpl': LTPLMeas, 'cv': CVMeas, 'iv': IVMeas
    }

    
    def get_queryset(self):
        queryset = Sample.objects.select_related('material').all()
    
        # URL에서 필터 값 가져오기
        search_query = self.request.GET.get('q', '')
        pd_equip_filter = [equip for equip in self.request.GET.get('pd_equip', ',').split(',') if equip]
        ms_equip_filters = [equip for equip in self.request.GET.get('ms_equip', ',').split(',') if equip]
        mat_type_filters = [equip for equip in self.request.GET.get('mat_type', ',').split(',') if equip]
    
        # 🔹 검색 필터 적용
        if search_query:
            queryset = queryset.filter(material__mat_name__icontains=search_query)
    
        # 🔹 제작 장비 (pd_equip) 필터 적용
        if pd_equip_filter:
            mat_name_sets = []
            for equip in pd_equip_filters:
                mat_names = set(
                    Sample.objects.filter(pd_equip__iexact=equip).values_list('material__mat_name', flat=True)
                )
                mat_name_sets.append(mat_names)
            
            if mat_name_sets:
                # 교집합으로 필터링된 mat_name 목록을 구함
                intersection_mat_names = set.intersection(*mat_name_sets)
                queryset = queryset.filter(material__mat_name__in=intersection_mat_names)
            else:
                queryset = queryset.none()
        
        # 🔹 측정 장비 (ms_equip) 필터 적용 (AND 조건 적용)
        if ms_equip_filters:
            # 각 ms_equip 조건별로 mat_name 목록을 얻고, 그들의 교집합을 구함
            mat_name_sets = []
            for equip in ms_equip_filters:
                mat_names = set(
                    Sample.objects.filter(ms_equip__iexact=equip).values_list('material__mat_name', flat=True)
                )
                mat_name_sets.append(mat_names)
            
            if mat_name_sets:
                # 교집합으로 필터링된 mat_name 목록을 구함
                intersection_mat_names = set.intersection(*mat_name_sets)
                queryset = queryset.filter(material__mat_name__in=intersection_mat_names)
            else:
                queryset = queryset.none()
    
        if mat_type_filters:
            for mat_type in mat_type_filters:
                queryset = queryset.filter(material__mat_type__icontains=mat_type)
    
        queryset = queryset.distinct()
    
        # 🔥 아래 코드는 유지 (전체 데이터 유지해서 버튼 사라짐 방지)
        materials = {}
        all_samples = Sample.objects.select_related('material').all()
    
        for sample in all_samples:
            mat_name = sample.material.mat_name
            if mat_name not in materials:
                materials[mat_name] = {
                    'mat_name': mat_name,
                    'mass_code': sample.material.mass_code,
                    'mat_type': sample.material.mat_type.split(',') if sample.material.mat_type else [],
                    'pd_equip_list': set(),
                    'ms_equip_list': set(),
                    'samples': []
                }
            materials[mat_name]['pd_equip_list'].add(sample.pd_equip)
            materials[mat_name]['ms_equip_list'].add(sample.ms_equip)
    
        filtered_mat_names = set(queryset.values_list('material__mat_name', flat=True))
    
        final_list = [value for key, value in materials.items() if key in filtered_mat_names]
        final_list.sort(key=lambda x: x['mat_name'])
    
        return final_list

    def get_context_data(self, **kwargs):
        """
        템플릿에서 사용할 데이터를 context에 추가.
        """
        context = super().get_context_data(**kwargs)
        context['material_data'] = context.get('materials', [])

        # 검색 및 필터 데이터 유지
        context['search_query'] = self.request.GET.get('q', '')
        context['pd_equip'] = [equip for equip in self.request.GET.get('pd_equip', ',').split(',') if equip]
        context['ms_equip'] = [equip for equip in self.request.GET.get('ms_equip', ',').split(',') if equip]
        context['mat_type'] = [type for type in self.request.GET.get('mat_type', ',').split(',') if type]

        # 필터링 가능한 `pd_equip`, `ms_equip`, `mat_type` 목록 정리
        pd_equip_data = set()
        ms_equip_data = set()
        mat_type_data = set()

        for material in context['material_data']:
            pd_equip_data.update(material['pd_equip_list'])
            ms_equip_data.update(material['ms_equip_list'])
            mat_type_data.update(material['mat_type'])

        context['pd_equip_data'] = sorted(pd_equip_data)
        context['ms_equip_data'] = sorted(ms_equip_data)
        context['mat_type_data'] = sorted(mat_type_data)

        return context

class MeasDetailView(DetailView):
    model = Sample
    template_name = 'dvmt/meas_detail.html'
    context_object_name = 'sample'

    def get_object(self):
        mat_name = self.kwargs.get('mat_name')
        return Sample.objects.filter(material__mat_name=mat_name).distinct()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        mat_name = self.kwargs.get('mat_name')
    
        related_samples = Sample.objects.filter(material__mat_name=mat_name)
        pd_equip_list = sorted(set([equip.strip() for equip in related_samples.values_list('pd_equip', flat=True)]))
    
        # 모든 fitting_results 미리 가져오기
        fitting_results = FittingResult.objects.filter(sample__material__mat_name=mat_name)
        
        def format_value(val, precision="{:.2f}"):
            if val is None:
                return "-"
            if isinstance(val, (int, float)) and int(val) == 9999:
                return "측정불가"
            return precision.format(val)
            
        def format_pair_value(v1, v2, decimal_fmt=".2e"):
            def fmt(v):
                if v is None:
                    return "-"
                if isinstance(v, (int, float)) and int(v) == 9999:
                    return "측정불가"
                return f"{v:{decimal_fmt}}"
        
            return f"{fmt(v1)}/{fmt(v2)}"
    
        # fitting_data 재구성
        fitting_data = {}
        for pd in pd_equip_list:
            fitting_data[pd] = {
                "ac3_intersection_ev": set(),
                "LUMO_uvvis": set(),
                "uvvis_bandgap": set(),
                "ltpl_triplet_energy": set(),
                "plqy_value": set(),
                "pl_peak_wavelength": set(),
                "trpl_prompt_tau": set(),
                "trpl_delayed_tau": set(),
                "ellipso_is": set(),
                "cv_zerocap": set(),
                "iv_pf_factor": set(),
            }
            pd_samples = related_samples.filter(pd_equip=pd)
            for sample in pd_samples:
                fit = fitting_results.filter(sample=sample).first()
                if fit:
                    if fit.pl_peak_wavelength:
                        fitting_data[pd]["pl_peak_wavelength"].add(format_value(fit.pl_peak_wavelength, "{:.0f}")),
                    if fit.plqy_value:
                        fitting_data[pd]["plqy_value"].add(format_value(fit.plqy_value, "{:.3f}")),
                    if fit.uvvis_bandgap:
                        fitting_data[pd]["uvvis_bandgap"].add(format_value(fit.uvvis_bandgap, "{:.2f}")),
                    if fit.ac3_intersection_ev:
                        fitting_data[pd]["ac3_intersection_ev"].add(format_value(fit.ac3_intersection_ev, "{:.2f")),
                    if fit.ltpl_triplet_energy:
                        fitting_data[pd]["ltpl_triplet_energy"].add(format_value(fit.ltpl_triplet_energy, "{:.2f}")),
                    if fit.trpl_prompt_tau:
                        fitting_data[pd]["trpl_prompt_tau"].add(format_value(fit.trpl_prompt_tau, "{:.1f}")),
                    if fit.trpl_delayed_tau:
                        fitting_data[pd]["trpl_delayed_tau"].add(format_value(fit.trpl_delayed_tau, "{:.1f}")),
                   
                    fitting_data[pd]["ellipso_is"].add("O" if fit.ellipso_is else "-"),
                    
                    if fit.iv_h_zero_field_mobility is not None or fit.iv_e_zero_field_mobility is not None:
                        iv_mobility = format_pair_value(fit.iv_h_zero_field_mobility, fit.iv_e_zero_field_mobility)
                        fitting_data[pd]["iv_zero_field_mobility"].add(iv_mobility)
                    
                    if fit.iv_h_factor is not None or fit.iv_e_factor is not None:
                        iv_factor = format_pair_value(fit.iv_h_factor, fit.iv_e_factor)
                        fitting_data[pd]["iv_pf_factor"].add(iv_factor)
                    
                    if fit.cv_h_permittivity is not None or fit.cv_e_permittivity is not None:
                        cv_perm = format_pair_value(fit.cv_h_permittivity, fit.cv_e_permittivity)
                        fitting_data[pd]["cv_permittivity"].add(cv_perm)
                    
                    if fit.cv_h_zerocap is not None or fit.cv_e_zerocap is not None:
                        cv_zcap = format_pair_value(fit.cv_h_zerocap, fit.cv_e_zerocap)
                        fitting_data[pd]["cv_zerocap"].add(cv_zcap)
                    
                    if fit.cv_h_maxcap is not None or fit.cv_e_maxcap is not None:
                        cv_mcap = format_pair_value(fit.cv_h_maxcap, fit.cv_e_maxcap)
                        fitting_data[pd]["cv_maxcap"].add(cv_mcap)
                    
        # set → sorted list 변환
        for pd, value_dict in fitting_data.items():
            for key, value in value_dict.items():
                fitting_data[pd][key] = sorted(list(value))
        
        # selected_pd_equip 설정(첫 번째를 기본값으로)
        selected_pd_equip = self.request.GET.get('pd_equip')
        if not selected_pd_equip or selected_pd_equip not in pd_equip_list:
            selected_pd_equip = pd_equip_list[0] if pd_equip_list else None
    
        context.update({
            "mat_name" : mat_name,
            "pd_equip_list" : pd_equip_list,
            "samples" : related_samples,
            "fitting_data" : fitting_data,
            "selected_pd_equip" : selected_pd_equip,
        })

        return context
        

@login_required
def meas_compare(request):
    mat_name_str = request.GET.get('mat_name', '')
    selected_mat_names = mat_name_str.split(',') if mat_name_str else []
    
    # 1. 모든 샘플 조회
    initial_samples_qs = Sample.objects.filter(material__mat_name__in=selected_mat_names)
    if not samples_qs.exists();
		return render(request, 'dvmt/meas_compare.html', {
            'error': 'No samples found for the selected materials.'
        }) 

    # 2. selected filter 보정
    selected_pd_equip = request.GET.get('pd_equip', 'All')
    selected_ms_equip = request.GET.get('ms_equip')
    selected_ms_equip = (selected_ms_equip.lower() if selected_ms_equip else selected_ms_equip)

    sample_ids = list(samples_qs.values_list('id', flat=True))
    all_pd_equip = sorted(set(samples_qs.values_list('pd_equip', flat=True)))
    

    # 3. pd_equip에 따라 ms_pool 설정 
    ms_pool = (samples_qs if selected_pd_equip == "All" else samples_qs.filter(pd_equip=selected_pd_equip))
    
    # 4. ms_equip 정리    
    all_ms_equip = sorted(set(samples_qs.values_list("ms_equip", flat=True)))
    all_ms_equip = [equip.lower() for equip in all_ms_equip]
    if (not selected_ms_equip) or (selected_ms_equip not in all_ms_equip):
        selected_ms_equip = all_ms_equip[0] if all_ms_equip else None
    
    # 5. FittingResult 전체 수집
    fitting_results = FittingResult.objects.filter(sample_id__in=sample_ids)
    fitting_dict = {r.sample_id: r for r in fitting_results}

    # 6. 그래프 데이터 준비
    all_chart_data = {
        'pl': pl_chart(get_pl_data(sample_ids), sample_ids),
        'plqy': plqy_chart(get_plqy_data(sample_ids), sample_ids),
        'uvvis': uvvis_chart(get_uvvis_data(sample_ids), sample_ids),
        'ac3': ac3_chart(get_ac3_data(sample_ids), sample_ids),
        'ellipsometer': ellipsometer_chart(get_ellipsometer_data(sample_ids), sample_ids),
        'cv': cv_chart(get_cv_data(sample_ids), sample_ids),
        'iv': iv_chart(get_iv_data(sample_ids), sample_ids),
        'trpl': trpl_chart(get_trpl_data(sample_ids), sample_ids),
        'ltpl': ltpl_chart(get_ltpl_data(sample_ids), sample_ids),
    }
    
    if selected_ms_equip:
        chart_data = all_chart_data.get(
            selected_ms_equip.lower(), {'x': [], 'datasets': []})
    else:
        chart_data = {'x': [], 'datasets': []}
        
    target_equip = selected_ms_equip.lower() if selected_ms_equip else ""
    
    # 조건: 엘립소미터이거나, 데이터 내부에 y2가 있다고 명시된 경우(CV)
    show_y2_controller = (target_equip == 'ellipsometer') or chart_data.get('has_y2', False)

    # 7. table_data (병합: mat_name + pd_equip 기준)
    grouped_rows = defaultdict(lambda: {
        'material_name': '',
        'pd_equip': '',
        'sample_ids': [],
        'pl_property': [],
        'plqy_property': [],
        'uvvis_property': [],
        'ac3_property': [],
        'ellipsometer_property': [],
        'ltpl_property': [],
        'trpl_property': [],
        'cv_property': [],
        'iv_property': [],
    })

    for sample in initial_samples_qs:
        sid = sample.id
        result = fitting_dict.get(sid)
        key = (sample.material.mat_name, sample.pd_equip)
        row = grouped_rows[key]

        row['material_name'] = sample.material.mat_name
        row['pd_equip'] = sample.pd_equip
        row['sample_ids'].append(sid)

        if not result:
            continue

        # 기본 수치형 property
        value_map = {
            'pl_property': result.pl_peak_wavelength,
            'plqy_property': result.plqy_value,
            'uvvis_property': result.uvvis_bandgap,
            'ac3_property': result.ac3_intersection_ev,
            'ltpl_property': result.ltpl_triplet_energy,
        }
        format_map = {
            'pl_property': lambda v: f"{v:.0f}",
            'plqy_property': lambda v: f"{v:.3f}",
            'uvvis_property': lambda v: f"{v:.2f}",
            'ac3_property': lambda v: f"{v:.2f}",
            'ltpl_property': lambda v: f"{v:.2f}",
        }

        for key, value in value_map.items():
            if value is not None:
                row[key].append("측정불가" if int(value) == 9999 else format_map[key](value))

        if result.ellipso_is:
            row['ellipsometer_property'].append('raw data')
            
        prompt = result.trpl_prompt_tau
        delayed = result.trpl_delayed_tau
        
        if prompt is not None or delayed is not None:
            row['trpl_property'].append(f"{format_value(prompt, '{:.1f}')} / {format_value(delayed, '{:.1f}')}")
            
        cv_h = result.cv_h_zerocap
        cv_e = result.cv_e_zerocap
        iv_h = result.iv_h_zero_field_mobility
        iv_e = result.iv_e_zero_field_mobility
    
        if cv_h is not None or cv_e is not None:
            row['cv_property'].append(f"{format_value(cv_h, '{:.2e}')} / {format_value(cv_e, '{:.2e}')}")
        
        if iv_h is not None or iv_e is not None:
            row['iv_property'].append(f"{format_value(iv_h, '{:.2e}')} / {format_value(iv_e, '{:.2e}')}")


    # ✅ 테이블 구성: 리스트 → 문자열 조인 + table_id 부여
    table_data = []
    table_ids = []
    sampleid_to_tableid = {}
    
    for idx, row in enumerate(grouped_rows.values()):
        table_id = idx + 1  # 1부터 시작하는 고유 ID
        
        for sid in row["sample_ids"]:
            sampleid_to_tableid[sid] = table_id
    
        for k, v in row.items():
            if isinstance(v, list):
                row[k] = ", ".join(map(str, v))
    
        row['table_id'] = table_id  # JS에서 버튼에 쓰일 ID
        table_data.append(row)
        table_ids.append(table_id)
    
    row["sample_ids"] = ", ".join(map(str, row["sample_ids"]))

    context = {
        'data_for_selected_ms_equip': json.dumps(chart_data, default=str),
        'selected_pd_equip': selected_pd_equip,
        'selected_ms_equip': selected_ms_equip,
        'pd_equip_data': all_pd_equip,
        'ms_equip_data': all_ms_equip,
        'table_data': table_data,
        'sample_ids': sample_ids,  # 전체 그래프 데이터용
        'table_data_ids': table_ids,  # cmap 기준용
        'sampleid_to_tableid': json.dumps(sampleid_to_tableid),  # JS용 색상 매핑
        "show_y2_controller": show_y2_controller
    }

    return render(request, 'dvmt/meas_compare.html', context)

class MeasManualView(ListView):
    model = ManualFile
    template_name = 'dvmt/meas_manual.html'
    context_object_name = 'manual_files'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        manual_files = ManualFile.objects.all()
    
        conditions = {
            'plqy': 'plqy_manual_file',
            'uvvis': 'uvvis_manual_file',
            'ellipsometer' : 'ellipsometer_manual_file',
            'transient pl': 'trpl_manual_file',
            'transient el': 'trel_manual_file',
            'ups' : 'ups_manual_file',
            'edo' : 'edo_manual_file',
            'impedance' : 'is_manual_file',
            'pl': 'pl_manual_file' #가장마지막에 처리
        }
    
        file_dict = {key: None for key in conditions.values()}
    
        for file in manual_files:
            file_title = file.title.lower()
    
            for condition, dict_key in conditions.items():
                if condition in file_title:
                    file_dict[dict_key] = file.file.url
                    break
    
        context.update(file_dict)
        return context
        
        
        

        
        

@login_required
def diagram_builder_view(request):
    """에너지 다이어그램 빌더 메인 페이지"""
    
    CHART_COLORS = [
		"#000000",
		"#FF0000",
		...
		"#404040",
	]
    
    # mat_type 목록 가져오기 (필터용)
    mat_types = FittingResult.objects.filter(
        ac3_intersection_ev__isnull=False
    ).values_list('sample__material__mat_type', flat=True).distinct()
    
    # 사용자의 저장된 다이어그램 목록
    user_diagrams = DiagramBuilder.objects.filter(created_by=request.user)
    
    context = {
        'mat_types': list(mat_types),
        'user_diagrams': user_diagrams,
        'electrode_presets': ELECTRODE_PRESETS,
        "chart_colors": json.dumps(CHART_COLORS),
    }
    
    return render(request, 'dvmt/diagram_builder.html', context)


@require_http_methods(["GET"])
def search_materials_api(request):
    """재료 검색 API (Tabulator 좌측 테이블용)"""
    
    search_query = request.GET.get('search', '')
    mat_type_filter = request.GET.get('mat_type', '')
    
    # Material 기준으로 조회
    from dvmt.models import Material
    
    materials_queryset = Material.objects.all()
    
    # 검색 필터링
    if search_query:
        materials_queryset = materials_queryset.filter(
            Q(mat_name__icontains=search_query) |
            Q(mat_code__icontains=search_query)
        )
    
    if mat_type_filter:
        materials_queryset = materials_queryset.filter(mass_type=mat_type_filter)
    
    # 각 Material에 대해 HOMO와 Bandgap 찾기
    materials = []
    for material in materials_queryset:  # enumerate 제거!
        # 해당 Material의 모든 FittingResult 조회
        fitting_results = FittingResult.objects.filter(
            sample__material=material
        ).select_related('sample')
        
        # HOMO 찾기 (ac3_intersection_ev가 있는 것 중 가장 최신)
        homo_result = fitting_results.filter(
            ac3_intersection_ev__isnull=False
        ).order_by('-created_at').first()
        
        # Bandgap 찾기 (uvvis_bandgap이 있는 것 중 가장 최신)
        bandgap_result = fitting_results.filter(
            uvvis_bandgap__isnull=False
        ).order_by('-created_at').first()
        
        # HOMO 또는 Bandgap 중 하나라도 없으면 스킵
        if not homo_result or not bandgap_result:
            continue
        
        # 데이터 계산
        homo = -homo_result.ac3_intersection_ev
        bandgap = bandgap_result.uvvis_bandgap
        lumo = homo + bandgap
        
        mat_code = f"({material.mat_code})" if material.mat_code else ""
        
        materials.append({
            'id': material.id,
            'homo_fitting_id': homo_result.id,
            'bandgap_fitting_id': bandgap_result.id,
            'no': len(materials) + 1,  # 여기서 수정! 실제 리스트 길이 + 1
            'mat_name': f"{material.mat_name} {mat_code}".strip(),
            'mat_type': material.mass_type or '',
            'homo': round(homo, 2),
            'lumo': round(lumo, 2),
            'bandgap': round(bandgap, 2),
        })
    
    return JsonResponse({'materials': materials})


@login_required
@require_http_methods(["POST"])
def save_diagram_api(request):
    """다이어그램 저장 API"""
    
    try:
        data = json.loads(request.body)
        diagram_name = data.get('name', 'Untitled Diagram')
        layers_data = data.get('layers', [])
        
        # DiagramBuilder 생성
        diagram = DiagramBuilder.objects.create(
            name=diagram_name,
            created_by=request.user,
        )
        
        # 인접한 같은 레이어명끼리 그룹핑
        grouped_layers = []
        current_group = None
        
        for item in layers_data:
            layer_name = item.get('layer_name', 'Layer')
            
            if current_group is None or current_group['name'] != layer_name:
                current_group = {'name': layer_name, 'materials': []}
                grouped_layers.append(current_group)
            
            current_group['materials'].append(item)
        
        # DiagramLayer 및 DiagramMaterial 생성
        for position, group in enumerate(grouped_layers):
            layer = DiagramLayer.objects.create(
                diagram=diagram,
                layer_name=group['name'],
                position=position
            )
            
            for mat_position, material_data in enumerate(group['materials']):
	            if material_data.get('is_custom'):
	                DiagramMaterial.objects.create(
	                    layer=layer,
	                    custom_material_name=material_data.get('mat_name'),
	                    custom_homo=material_data.get('homo'),
	                    custom_lumo=material_data.get('lumo'),
	                    custom_work_function=material_data.get('work_function'),
	                    custom_color=material_data.get('color', 'rgba(200, 200, 200, 0.6)'),  # 색상 저장!
	                    position_in_layer=mat_position
	                )
	            else:
	                from dvmt.models import Material
	                material = Material.objects.get(id=material_data.get('id'))
	                homo_fr = FittingResult.objects.get(id=material_data.get('homo_fitting_id'))
	                bandgap_fr = FittingResult.objects.get(id=material_data.get('bandgap_fitting_id'))
	                
	                # DB Material도 color 저장할 수 있도록 (선택사항)
	                DiagramMaterial.objects.create(
	                    layer=layer,
	                    material=material,
	                    homo_fitting_result=homo_fr,
	                    bandgap_fitting_result=bandgap_fr,
	                    custom_color=material_data.get('color', 'rgba(200, 200, 200, 0.6)'),  # 색상 저장!
	                    position_in_layer=mat_position
	                )
        
        return JsonResponse({
            'success': True,
            'diagram_id': diagram.id,
            'message': 'Diagram saved successfully'
        })
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_http_methods(["GET"])
def load_diagram_api(request, diagram_id):
    """다이어그램 불러오기 API"""
    
    try:
        diagram = DiagramBuilder.objects.get(id=diagram_id, created_by=request.user)
        
        layers = []
        for layer in diagram.layers.all().order_by('position'):
            for dm in layer.materials.all().order_by('position_in_layer'):
                if dm.material:  # DB Material
                    homo_value = dm.homo_fitting_result.ac3_intersection_ev
                    bandgap_value = dm.bandgap_fitting_result.uvvis_bandgap
                    
                    # HOMO가 양수면 음수로 변환
                    if homo_value > 0:
                        homo_value = -homo_value
                    
                    lumo_value = homo_value + bandgap_value
                    
                    print(f"Loading {dm.material.mat_name}: HOMO={homo_value}, LUMO={lumo_value}")  # 디버깅
                    
                    layers.append({
                        'id': dm.material.id,
                        'homo_fitting_id': dm.homo_fitting_result.id,
                        'bandgap_fitting_id': dm.bandgap_fitting_result.id,
                        'no': len(layers) + 1,
                        'mat_name': dm.material.mat_name,
                        'mass_code': dm.material.mat_code,
                        'mat_type': dm.material.mass_type,
                        'layer_name': layer.layer_name,
                        'homo': homo_value,  # 음수 보장
                        'lumo': lumo_value,  # 음수 보장
                        'bandgap': bandgap_value,
                        'work_function': None,
                        'color': dm.custom_color or 'rgba(200, 200, 200, 0.6)',
                        'is_custom': False
                    })
                else:  # Custom Material
                    print(f"Loading custom: {dm.custom_material_name}, HOMO={dm.custom_homo}, LUMO={dm.custom_lumo}, WF={dm.custom_work_function}")  # 디버깅
                    
                    layers.append({
                        'id': f'custom_{dm.id}',
                        'homo_fitting_id': None,
                        'bandgap_fitting_id': None,
                        'no': len(layers) + 1,
                        'mat_name': dm.custom_material_name,
                        'mass_code': '',
                        'mat_type': 'Custom',
                        'layer_name': layer.layer_name,
                        'homo': dm.custom_homo,
                        'lumo': dm.custom_lumo,
                        'bandgap': dm.custom_lumo - dm.custom_homo if dm.custom_lumo and dm.custom_homo else None,
                        'work_function': dm.custom_work_function,
                        'color': dm.custom_color or 'rgba(200, 200, 200, 0.6)',
                        'is_custom': True
                    })
        
        print(f"Total layers loaded: {len(layers)}")  # 디버깅
        
        return JsonResponse({
            'success': True,
            'name': diagram.name,
            'layers': layers
        })
    
    except Exception as e:
        print(f"Error loading diagram: {str(e)}")  # 디버깅
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@login_required
@require_http_methods(["GET"])
def list_diagrams_api(request):
    """사용자의 다이어그램 목록 API"""
    
    try:
        diagrams = DiagramBuilder.objects.filter(created_by=request.user)
        
        result = []
        for diagram in diagrams:
            layer_count = diagram.layers.count()  # 레이어 개수 계산
            
            result.append({
                'id': diagram.id,
                'name': diagram.name,
                'created_at': diagram.created_at.isoformat() if diagram.created_at else None,
                'layer_count': layer_count
            })
        
        return JsonResponse({'diagrams': result})
    
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)
        
        
@login_required
@require_http_methods(["POST"])
def update_diagram_api(request, diagram_id):
    """다이어그램 업데이트 API"""
    
    try:
        # 자신의 다이어그램만 수정 가능
        diagram = DiagramBuilder.objects.get(id=diagram_id, created_by=request.user)
        
        data = json.loads(request.body)
        diagram_name = data.get('name', 'Untitled Diagram')
        layers_data = data.get('layers', [])
        
        # 기존 레이어 삭제
        diagram.layers.all().delete()
        
        # 이름 업데이트
        diagram.name = diagram_name
        diagram.save()
        
        # 인접한 같은 레이어명끼리 그룹핑
        grouped_layers = []
        current_group = None
        
        for item in layers_data:
            layer_name = item.get('layer_name', 'Layer')
            
            if current_group is None or current_group['name'] != layer_name:
                current_group = {'name': layer_name, 'materials': []}
                grouped_layers.append(current_group)
            
            current_group['materials'].append(item)
        
        # DiagramLayer 및 DiagramMaterial 생성
        for position, group in enumerate(grouped_layers):
            layer = DiagramLayer.objects.create(
                diagram=diagram,
                layer_name=group['name'],
                position=position
            )
            
            for mat_position, material_data in enumerate(group['materials']):
                if material_data.get('is_custom'):
                    DiagramMaterial.objects.create(
                        layer=layer,
                        custom_material_name=material_data.get('mat_name'),
                        custom_homo=material_data.get('homo'),
                        custom_lumo=material_data.get('lumo'),
                        custom_work_function=material_data.get('work_function'),
                        custom_color=material_data.get('color', '#999999'),
                        position_in_layer=mat_position
                    )
                else:
                    from dvmt.models import Material
                    material = Material.objects.get(id=material_data.get('id'))
                    homo_fr = FittingResult.objects.get(id=material_data.get('homo_fitting_id'))
                    bandgap_fr = FittingResult.objects.get(id=material_data.get('bandgap_fitting_id'))
                    
                    DiagramMaterial.objects.create(
                        layer=layer,
                        material=material,
                        homo_fitting_result=homo_fr,
                        bandgap_fitting_result=bandgap_fr,
                        position_in_layer=mat_position
                    )
        
        return JsonResponse({
            'success': True,
            'diagram_id': diagram.id,
            'message': 'Diagram updated successfully'
        })
    
    except DiagramBuilder.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Diagram not found or you do not have permission'
        }, status=404)
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)
        
@login_required
@require_http_methods(["POST"])
def delete_diagram_api(request, diagram_id):
    """다이어그램 삭제 API"""
    
    try:
        diagram = DiagramBuilder.objects.get(id=diagram_id, created_by=request.user)
        diagram_name = diagram.name
        diagram.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Diagram "{diagram_name}" deleted successfully'
        })
    
    except DiagramBuilder.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Diagram not found or you do not have permission'
        }, status=404)
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)