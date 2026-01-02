import numpy as np
import pandas as pd
from scipy.interpolate import interp1d
import numbers
from collections import defaultdict
import csv
import io
from pathlib import Path
from pao.models import TVColorFilter
from shapely.geometry import Polygon
from sklearn.linear_model import LinearRegression
from scipy.optimize import curve_fit
from django.db import models
import re
from functools import lru_cache
         
import logging

logger = logging.getLogger(__name__)


TRISTIMULUS = {...}

PRECISION_MAP = {
    "V(volt)": 2,
    "CD(cd/A)": 1,
    "n(QE)": 1,
    "x": 3,
    "y": 3,
    "eff": 1,
    "volt": 2,
    "CE(cd/A)": 2,
    "B Peak": 1,
    "B Peak WL":1,
    "B FWHM": 1,
    "YG Peak": 3,
    "YG Peak WL": 1,
    "YG FWHM": 1,
    "J10 Count": 0,
    "J100 Count": 0,
}

CIE1976_GAMUT = [
    (0.25, 0.017),
    ...
    (0.25, 0.017)
    
COLOR_SPACE_XY = {
    "sRGB": [(0.640, 0.330), (0.300, 0.600), (0.150, 0.060)],
    "DCI-P3": [(0.680, 0.320), (0.265, 0.690), (0.150, 0.060)],
    "BT.2020": [(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)]
}

WL_INTERP= np.arange(380.0, 781.0, 1.0)

TABLE_ROW_HEADERS = {
    "ivl": {
        "J10": ["V(volt)", "CE(cd/A)", "n(QE)", "x", "y"],
        "J100": ["V(volt)"],
        "Spec": ["B Peak", "B Peak WL", "B FWHM", "YG Peak", "YG Peak WL", "YG FWHM", "LBL"],
        # "Count": ["J10 Count", "J100 Count"],
    },
    "ivl_color": {
        "Main": (
            [f"{ch}_{suffix}" for ch in ["R", "G", "B", "W"] for suffix in ["x", "y", "eff"]] +
            [f"{name}-{metric}" for name in COLOR_SPACE_XY.keys() for metric in ["user_ratio", "overlap_ratio"]]
        )
    },
    "angle": {
        "Main": ["Angle-Δu'v'(60°)"]
    },
    "lt": {
        "Main": [
            "Sample Info",
            "Condition",
            "T95-W", "T95-R", "T95-G", "T95-B", "T95-Bpeak",
            "Δv(T95-Green)"
        ]
    }
}


def is_number(x: any) -> bool:
    try:
        float(x)
        return True
    except (TypeError, ValueError):
        return False
        
def safe_avg(values: list[any]) -> float:
    numeric_values = [float(v) for v in values if is_number(v)]
    return sum(numeric_values) / len(numeric_values) if numeric_values else 0

def get_formatted_avg(values, metric):
    """
    평균 계산 시 None 또는 문자열("-")은 제외
    값이 없으면 "-" 반환
    """
    # None과 "-" 필터링
    clean_values = [v for v in values if isinstance(v, (int, float))]

    if not clean_values:
        return "-"

    try:
        avg = sum(clean_values) / len(clean_values)
        return f"{avg:.2f}"
    except Exception:
        return "-"
    
def tv_get_valid_does_grouped(does: list[models.Model]) -> dict[str, list[models.Model]]:
    """
    IVL, LT, ANGLE 등 dataset별로 DOE를 분류하여 반환
    각 데이터셋은 중복 없이 set 기반으로 수집 후 list로 변환
    Note: prefetch_related([...])가 되어 있어야 효율적
    """
    dataset_fields = ["ivl_set", "lt_set", "angle_set"]
    valid_does = {field.replace("_set", ""): set() for field in dataset_fields}

    for doe in does:
        for field in dataset_fields:
            related_set = getattr(doe, field, None)
            if related_set and related_set.exists():
                valid_does[field.replace("_set", "")].add(doe)

    return {k: sorted(v, key=lambda x: x.id) for k, v in valid_does.items()}
    
# def tv_get_ivl_labels(does: list[models.Model]) -> dict[str, list[str]]:
#     """
#     IVL 기준으로 DOE를 J10 / J100으로 분류 (ivl이 없는 DOE는 제외)
#     Note: prefetch_related('ivl_set') 되어 있어야 효율적
#     """
#     ivl_labels = {"J10": [], "J100": []}
#     for doe in does:
#         label = f"DOE-{doe.id}"
#         found_j10 = found_j100 = False
#         for ivl in doe.ivl_set.all():
#             flag = ivl.check_sweep_10ma
#             if flag == 10 and not found_j10:
#                 ivl_labels["J10"].append(label)
#                 found_j10 = True
#             elif flag == 100 and not found_j100:
#                 ivl_labels["J100"].append(label)
#                 found_j100 = True
#     return ivl_labels
    
def tv_get_row_header(table_key: str) -> list[str]:
    """
    table_key에 해당하는 row header 목록을 반환.
    - 'Main' 키가 있으면 그것을 반환.
    - 없으면 하위 dict의 key와 metric을 조합해 'J10-V(volt)' 형식으로 반환.
    """
    if table_key not in TABLE_ROW_HEADERS:
        raise ValueError(f"Unknown table_key: {table_key}")

    header_info = TABLE_ROW_HEADERS[table_key]

    # Main 키가 있는 경우 → 그대로 반환
    if "Main" in header_info:
        return list(header_info["Main"])

    # Main 키가 없으면 key-metric 조합 생성
    combined_headers = []
    for group_key, metrics in header_info.items():
        for metric in metrics:
            combined_headers.append(f"{group_key}-{metric}")
    return combined_headers


def tv_generate_base_table(table_key: str, doe_labels: list[str], default_value: str = "") -> dict:
    """
    주어진 table_key에 대해, 모든 row header와 DOE label을 포함한 빈 테이블 생성
    default_value: 기본값 설정 (기본: "-", 공백 원하면 "" 또는 None)
    """
    headers = tv_get_row_header(table_key)
    base_table = {}
    for header in headers:
        base_table[header] = {"fieldName": header}
        for label in doe_labels:
            base_table[header][label] = default_value
    return base_table
    
def tv_process_color_filter_upload(label: str, file: io.BytesIO, request: HttpRequest) -> tuple[bool, str]:
    """ CSV/TEXT 파일의 색상 필터 데이터를 처리하고 DB에 저장"""
    
    ext = Path(file.name).suffix.lower()
    decoded_file = file.read().decode("UTF-8")
    
    # ✨ 변경: label + created_user 조합으로 중복 체크
    if TVColorFilter.objects.filter(label=label, created_user=request.user).exists():
        return (False, f"[{label}]은 이미 존재합니다. 기존 항목을 삭제한 후 다시 업로드 해주세요.")
        
    try:
        if ext == ".csv":
            reader = csv.reader(io.StringIO(decoded_file), delimiter=",")
            rows = list(reader)
        else:
            lines = decoded_file.strip().splitlines()
            rows = [line.strip().split() for line in lines if line.strip()]

        if not rows or len(rows) < 2:
            return False, "파일에 데이터가 없습니다."

        first_row = rows[0]
        is_header = any(cell.isalpha() or not is_number(cell) for cell in first_row)
        data_rows = rows[1:] if is_header else rows

        rgb_data = {}
        for row in data_rows:
            if len(row) < 4:
                continue
            try:
                wl = float(row[0])
                if not 380 <= wl <= 780:
                    continue
                rgb_data[str(wl)] = {
                    "r": float(row[1]),
                    "g": float(row[2]),
                    "b": float(row[3]),
                }
            except (ValueError, IndexError):
                continue

        if len(rgb_data) < 300:
            return False, "380~780nm 사이의 유효한 데이터가 너무 적습니다."

        # ✨ 변경: get_client_ip 사용
        TVColorFilter.objects.create(
            label=label,
            rgb_data=rgb_data,
            created_user=request.user,
            ip=get_client_ip(request)[0]
        )
        return True, f"{label} 업로드 성공 ({len(rgb_data)}개)"

    except Exception as e:
        return False, str(e)
    
def tv_generate_ivl_table(
    does: list[models.Model], 
    all_doe_labels: list[str] = None
) -> tuple[dict, dict]:
    """
    IVL 평균 테이블 생성 (DOE 기준)
    - DOE 안에서 J10 IVL들끼리 평균
    - DOE 안에서 J100(Sweep) IVL들끼리 평균 (V(volt) 중심)
    """
    doe_labels = all_doe_labels or [f"DOE-{doe.id}" for doe in does]
    pivot_rows = tv_generate_base_table("ivl", doe_labels)

    # Count 항목 추가
    for count_key in ["J10 Count", "J100 Count"]:
        pivot_rows[count_key] = {"fieldName": count_key}
        for label in doe_labels:
            pivot_rows[count_key][label] = 0  # ✅ "-" → 0으로 초기화

    pivot_structure = TABLE_ROW_HEADERS["ivl"]
    j10_keys, j100_keys, spec_keys = (
        pivot_structure["J10"],
        pivot_structure["J100"],
        pivot_structure["Spec"],
    )

    spectrum_storage = {label: {"J10": [], "J100": []} for label in doe_labels}

    for doe in does:
        label = f"DOE-{doe.id}"
        if label not in doe_labels:
            continue

        ivl_data = {"J10": defaultdict(list), "J100": defaultdict(list), "Spec": defaultdict(list)}
        
        # ✅ IVL 개수 카운터 추가
        j10_count = 0
        j100_count = 0
        
        # ✅ 디버깅용: IVL ID 수집
        j10_ivl_ids = []
        j100_ivl_ids = []

        for ivl in doe.ivl_set.all():
            expt = ivl.expt or []

            if ivl.is_J10:
                # --- J10 평균 처리 ---
                j10_entries = [e for e in expt if abs(float(e.get("J(mA/cm2)", -999)) - 10) < 0.5]
                if not j10_entries and expt:
                    j10_entries = [expt[0]]

                # ✅ entry 루프 밖에서 유효성 체크
                has_valid_data = False
                for entry in j10_entries:
                    for key in j10_keys:
                        val = entry.get(key)
                        ivl_data["J10"][key].append(float(val) if val is not None else None)
                        if val is not None:
                            has_valid_data = True
                
                # ✅ IVL당 1번만 카운트
                if has_valid_data:
                    j10_count += 1
                    j10_ivl_ids.append(ivl.ivl_id or f"pk-{ivl.pk}")  # ✅ ID 수집

                # 스펙트럼 분석
                if ivl.expt_spec:
                    spec = ivl.expt_spec[0].get("0", {})
                    if spec:
                        spectrum_storage[label]["J10"].append(spec)
                        spec_analysis = TVSpectrumAnalyzer.analyze_spec(spec)
                        for k, v in spec_analysis.items():
                            ivl_data["Spec"][k].append(v)
                    else:
                        for k in spec_keys:
                            ivl_data["Spec"][k].append(None)
                else:
                    for k in spec_keys:
                        ivl_data["Spec"][k].append(None)

            else:
                # --- J100 평균 처리 ---
                # ✅ 면적 계산
	            area = calculate_area_from_first_points(expt, ivl.id)
	            if area is None:
	                continue  # 면적 계산 불가 시 스킵
	            
	            # ✅ 전류밀도 재계산
	            recalculated_expt = recalculate_current_density(expt, area)
	            
	            # ✅ 재계산된 데이터에서 J≈100 탐색
	            entry_100 = next(
	                (e for e in recalculated_expt if abs(float(e.get("J(mA/cm2)", -999)) - 100) < 0.5),
	                None,
	            )
                if entry_100:
                    v_val = entry_100.get("V(volt)")
                    if v_val is not None:  # ✅ 유효 데이터가 있을 때만
                        ivl_data["J100"]["V(volt)"].append(float(v_val))
                        j100_count += 1  # ✅ IVL당 1번 
                        j100_ivl_ids.append(ivl.ivl_id or f"pk-{ivl.pk}")  # ✅ ID 수집

                # 스펙트럼 저장
                if ivl.expt_spec:
                    spec = ivl.expt_spec[0].get("0", {})
                    if spec:
                        spectrum_storage[label]["J100"].append(spec)
        
        # ✅ 디버깅 로그 출력
        logger.info(
            f"{label} | J10: {j10_count}개 {j10_ivl_ids} | J100: {j100_count}개 {j100_ivl_ids}"
        )

        # DOE 단위 평균값 계산
        for metric in j10_keys:
            pivot_rows[f"J10-{metric}"][label] = get_formatted_avg(
                ivl_data["J10"].get(metric, []), metric
            )
        for metric in j100_keys:
            pivot_rows[f"J100-{metric}"][label] = get_formatted_avg(
                ivl_data["J100"].get(metric, []), metric
            )
        for spec_key in spec_keys:
            pivot_rows[f"Spec-{spec_key}"][label] = get_formatted_avg(
                ivl_data["Spec"].get(spec_key, []), spec_key
            )

        # ✅ 카운트 저장
        pivot_rows["J10 Count"][label] = j10_count
        pivot_rows["J100 Count"][label] = j100_count

    return pivot_rows, spectrum_storage
    
def calculate_area_from_first_points(expt: list[dict], ivl_id: int) -> float | None:
    """앞쪽 3개 포인트로 면적 계산 (A = I / J의 평균)"""
    areas = []
    
    for i in range(min(3, len(expt))):
        entry = expt[i]
        current = entry.get("Current(mA)")
        j = entry.get("J(mA/cm2)")
        
        if current is None or j is None or j == 0:
            logger.warning(
                f"IVL ID {ivl_id}: {i+1}번째 포인트에 유효한 Current 또는 J 값이 없습니다. "
                f"(Current={current}, J={j})"
            )
            continue
        
        areas.append(float(current) / float(j))
    
    if not areas:
        logger.error(
            f"IVL ID {ivl_id}: 앞쪽 3개 포인트 모두에서 면적 계산 불가. "
            f"해당 샘플 데이터를 스킵합니다."
        )
        return None
    
    avg_area = sum(areas) / len(areas)
    logger.debug(f"IVL ID {ivl_id}: 계산된 평균 면적 = {avg_area:.4f} cm²")
    return avg_area

def recalculate_current_density(expt: list[dict], area: float) -> list[dict]:
    """전류를 기준으로 모든 포인트의 전류밀도 재계산 (J = I / A)"""
    recalculated = []
    
    for entry in expt:
        current = entry.get("Current(mA)")
        
        if current is not None:
            new_j = float(current) / area
            new_entry = {
                "J(mA/cm2)": round(new_j, 2),  # 소수점 둘째자리 반올림
                "V(volt)": entry.get("V(volt)")
            }
            recalculated.append(new_entry)
    
    return recalculated
    
def tv_generate_angle_table(angles: list[models.Model], all_doe_labels: list[str] = None) -> tuple[dict, dict, dict]:
    """
    각도 데이터 테이블 생성 및 각도별 평균 계산
    반환: (angle_rows, angle_graph_data, angle_spectrum_data, angle_averages)
    """
    if all_doe_labels:
        doe_labels = all_doe_labels
    else:
        doe_labels = [f"DOE-{angle.doe.id}" for angle in angles]
    
    angle_rows = tv_generate_base_table("angle", doe_labels)
    angle_graph_data = {}
    angle_spectrum_data = {}
    
    for angle in angles:
        label = f"DOE-{angle.doe.id}"
        
        expt = angle.expt
        expt_spec = angle.expt_spec
        if not expt or not expt_spec:
            continue
        
        uv_by_angle = {}
        for entry in expt:
            try:
                filename = entry.get("filename", "")
                degree = int(filename.split("(")[-1].replace(")", ""))
                x, y = float(entry.get("x", 0)), float(entry.get("y", 0))
                u, v = TVSpectrumAnalyzer.xy_to_uv(x, y)
                uv_by_angle[degree] = (u, v)
                
            except (ValueError, KeyError) as e:
                logger.warning(f"Angle 데이터 파싱 오류(파일: {filename}): {e}")
                continue
        
        if 0 not in uv_by_angle:
            continue
        
        u0, v0 = uv_by_angle[0]
        delta_uv = {
            deg: round(((u - u0) ** 2 + (v - v0) ** 2) ** 0.5, 5)
            for deg, (u, v) in uv_by_angle.items()
        }
        
        angle_rows["Angle-Δu'v'(60°)"][label] = delta_uv.get(60, "N/A")
        angle_graph_data[label] = delta_uv
        angle_spectrum_data[label] = {
            entry.get("filename", ""): spec for entry, spec in zip(expt, expt_spec)
        }
    
    # 각도별 평균 계산
    angle_averages = calculate_angle_averages(angle_graph_data, doe_labels)
    angle_spectrum_averages = calculate_angle_spectrum_averages(angle_spectrum_data, doe_labels)
        
    return angle_rows, angle_averages, angle_spectrum_averages
    
def calculate_angle_averages(angle_graph_data: dict, doe_labels: list[str]) -> dict:
    """기존 angle_graph_data를 활용한 각도별 평균 계산"""
    angle_averages = {}
    
    # 모든 각도 수집
    all_angles = set()
    for doe_data in angle_graph_data.values():
        all_angles.update(doe_data.keys())
    
    all_angles = sorted(all_angles)
    
    for label in doe_labels:
        if label in angle_graph_data:
            angle_values = []
            delta_uv_values = []
            
            for angle in all_angles:
                if angle in angle_graph_data[label]:
                    angle_values.append(angle)
                    delta_uv_values.append(angle_graph_data[label][angle])
            
            if angle_values:
                angle_averages[label] = {
                    "angle": angle_values,
                    "delta_uv": delta_uv_values
                }
    
    return angle_averages
    
# PAO_pivot_table.py에 추가
def calculate_angle_spectrum_averages(angle_spectrum_data: dict, doe_labels: list[str]) -> dict:
    """
    DOE별, 각도별 스펙트럼 평균 계산
    
    Args:
        angle_spectrum_data: {doe_label: {filename: spectrum_dict}}
        doe_labels: DOE 라벨 리스트
    
    Returns:
        {doe_label: {angle: {"wavelength": [...], "intensity": [...]}}}
    """
    angle_spectrum_averages = {}
    
    # 각 파일명에서 각도 추출 패턴
    angle_patterns = {
        "(0)": 0, "(15)": 15, "(30)": 30, "(45)": 45, "(60)": 60
    }
    
    for doe_label in doe_labels:
        if doe_label not in angle_spectrum_data:
            continue
            
        doe_spectra = angle_spectrum_data[doe_label]
        angle_groups = {0: [], 15: [], 30: [], 45: [], 60: []}
        
        # 파일명 기준으로 각도별 그룹핑
        for filename, spectrum_dict in doe_spectra.items():
            for pattern, angle in angle_patterns.items():
                if pattern in filename:
                    if spectrum_dict:  # 스펙트럼 데이터가 있는 경우
                        angle_groups[angle].append(spectrum_dict)
                    break
        
        # 각도별 평균 계산
        doe_angle_spectrum_averages = {}
        for angle, spectra_list in angle_groups.items():
            if not spectra_list:
                continue
                
            # 스펙트럼을 380~780nm로 보간
            interpolated_spectra = []
            for spectrum in spectra_list:
			    try:
			        # 중첩된 딕셔너리에서 실제 스펙트럼 추출
			        if isinstance(spectrum, dict):
			            # 첫 번째 값이 스펙트럼 데이터라고 가정
			            actual_spectrum = next(iter(spectrum.values()))
			            spec_tuple = tuple(actual_spectrum.items())
			        else:
			            spec_tuple = tuple(spectrum.items())
			            
			        intensity_interp = TVSpectrumAnalyzer.get_interpolated_spectrum_cubic(spec_tuple)
			        interpolated_spectra.append(intensity_interp)
			    except Exception as e:
			        logger.warning(f"각도 스펙트럼 보간 실패 ({doe_label}, {angle}°): {e}")
			        continue
            
            if interpolated_spectra:
                # 파장별 평균 계산
                avg_intensities = np.mean(interpolated_spectra, axis=0)
                doe_angle_spectrum_averages[angle] = {
                    "wavelength": WL_INTERP.tolist(),  # 380~780nm
                    "intensity": avg_intensities.tolist()
                }
        
        if doe_angle_spectrum_averages:
            angle_spectrum_averages [doe_label] = doe_angle_spectrum_averages 
    
    return angle_spectrum_averages 

# PAO_pivot_table.py에 새 함수 추가

def calculate_angle_uv_components(angles: list[models.Model], all_doe_labels: list[str] = None) -> dict:
    """
    각도별 deltau', deltav' 성분 계산
    
    Returns:
        {doe_label: {"angle": [...], "delta_u": [...], "delta_v": [...]}}
    """
    if all_doe_labels:
        doe_labels = all_doe_labels
    else:
        doe_labels = [f"DOE-{angle.doe.id}" for angle in angles]
    
    uv_components = {}
    
    for angle in angles:
        label = f"DOE-{angle.doe.id}"
        
        expt = angle.expt
        if not expt:
            continue
        
        uv_by_angle = {}
        for entry in expt:
            try:
                filename = entry.get("filename", "")
                degree = int(filename.split("(")[-1].replace(")", ""))
                x, y = float(entry.get("x", 0)), float(entry.get("y", 0))
                u, v = TVSpectrumAnalyzer.xy_to_uv(x, y)
                uv_by_angle[degree] = (u, v)
                
            except (ValueError, KeyError) as e:
                logger.warning(f"Angle UV 데이터 파싱 오류(파일: {filename}): {e}")
                continue
        
        if 0 not in uv_by_angle:
            continue
        
        u0, v0 = uv_by_angle[0]
        
        # deltau', deltav' 개별 계산
        delta_u = {
            deg: round(u - u0, 5) for deg, (u, v) in uv_by_angle.items()
        }
        delta_v = {
            deg: round(v - v0, 5) for deg, (u, v) in uv_by_angle.items()
        }
        
        uv_components[label] = {
            "delta_u": delta_u,
            "delta_v": delta_v
        }
    
    # DOE별 평균 계산
    uv_averages = {}
    
    # 모든 각도 수집
    all_angles = set()
    for components in uv_components.values():
        all_angles.update(components["delta_u"].keys())
    all_angles = sorted(all_angles)
    
    for label in doe_labels:
        if label in uv_components:
            angle_values = []
            delta_u_values = []
            delta_v_values = []
            
            for angle_deg in all_angles:
                if angle_deg in uv_components[label]["delta_u"]:
                    angle_values.append(angle_deg)
                    delta_u_values.append(uv_components[label]["delta_u"][angle_deg])
                    delta_v_values.append(uv_components[label]["delta_v"][angle_deg])
            
            if angle_values:
                uv_averages[label] = {
                    "angle": angle_values,
                    "delta_u": delta_u_values,
                    "delta_v": delta_v_values
                }
    
    return uv_averages

def tv_generate_lt_table(
    lts: list[models.Model],
    color_filter: dict,
    aging_time: float = 30,
    all_doe_labels: list[str] = None
) -> tuple[dict, dict]:
    """
    LT 데이터 테이블 생성 및 시간별 평균 계산
    DOE별로 여러 LT 데이터가 있는 경우 평균값으로 처리
    반환: (lt_rows, lt_graph_data)
    """
    # DOE별로 LT 데이터 그룹핑
    doe_lt_groups = defaultdict(list)
    for lt in lts:
        doe_lt_groups[lt.doe.id].append(lt)
    
    # 전체 DOE 라벨 설정
    if all_doe_labels:
        doe_labels = all_doe_labels
    else:
        doe_labels = [f"DOE-{doe_id}" for doe_id in sorted(doe_lt_groups.keys())]
    
    lt_rows = tv_generate_base_table("lt", doe_labels)
    lt_graph_data = {}
    
    analyzer = TVSpectrumAnalyzer(color_filter)

    # DOE별로 처리
    for doe_id, lt_list in doe_lt_groups.items():
        label = f"DOE-{doe_id}"
        
        # DOE별 집계용 변수들
        doe_sample_infos = []
        doe_conditions = []
        doe_t95_values = defaultdict(list)
        doe_delta_vs = []
        doe_times_list = []
        doe_intensities = {
            "white": [],
            "rgb": {"R": [], "G": [], "B": []},
            "blue_peak": [],
            "vdelta": []
        }

        # DOE 내 모든 LT 데이터 처리
        for lt in lt_list:
            # 1) 데이터 준비
            times, white, rgb, blue_peak, vdelta = _prepare_lt_data(lt.expt, lt.expt_spec, analyzer)

            # sample info 전처리
            datafolder = lt.expt[0].get('datafolder', '')
            channel = lt.expt[0].get('[Channel]', '')
            
            folder_name = ""
            if datafolder:
                for part in re.split(r'[\\/]', datafolder):
                    if part.strip().startswith("#"):
                        folder_name = part.strip()
                        break
            try:
                channel_str = str(int(float(channel)))
            except (ValueError, TypeError):
                channel_str = str(channel)
            
            # J(mA/cm2), tempset 전처리
            try:
                j_value = str(int(round(float(lt.expt[0].get('J(mA/cm2)', 0)), 0)))
                t_value = str(int(round(float(lt.expt[0].get('tempset', 0)), 0)))
            except (ValueError, TypeError):
                j_value = str(lt.expt[0].get('J(mA/cm2)', ''))
                t_value = str(lt.expt[0].get('tempset', ''))
            
            # 2) T95 계산
            t95_values, t95_flags = {}, {}
            for key, arr in {
                "W": white,
                "R": rgb["R"],
                "G": rgb["G"],
                "B": rgb["B"],
                "Bpeak": blue_peak
            }.items():
                t95, is_pred = _find_t95(times, np.array(arr, dtype=float), aging_time)
                t95_values[key] = t95
                t95_flags[key] = is_pred
                if t95 != "-" and isinstance(t95, (int, float)):
                    doe_t95_values[key].append(t95)

            # 3) Δv 예측 (Green T95 시점)
            if t95_values.get("G") != "-":
                delta_v = _predict_vdelta(times, vdelta, t95_values["G"])
                if delta_v != "-" and isinstance(delta_v, (int, float)):
                    doe_delta_vs.append(delta_v)

            # 4) DOE별 데이터 수집
            doe_sample_infos.append(f"{folder_name}-ch{channel_str}")
            doe_conditions.append(f"{j_value}J-{t_value}°C")
            
            # 시계열 데이터 수집
            doe_times_list.append(times)
            doe_intensities["white"].append(white)
            doe_intensities["rgb"]["R"].append(rgb["R"])
            doe_intensities["rgb"]["G"].append(rgb["G"])
            doe_intensities["rgb"]["B"].append(rgb["B"])
            doe_intensities["blue_peak"].append(blue_peak)
            doe_intensities["vdelta"].append(vdelta)

        # DOE별 평균값 계산 및 테이블 저장
        if doe_sample_infos:
            lt_rows["Sample Info"][label] = doe_sample_infos[0]
            lt_rows["Condition"][label] = doe_conditions[0]
            
            # T95 값들의 평균
            for key in ["W", "R", "G", "B", "Bpeak"]:
                if key in doe_t95_values and doe_t95_values[key]:
                    avg_t95 = round(sum(doe_t95_values[key]) / len(doe_t95_values[key]), 2)
                    lt_rows[f"T95-{key}"][label] = avg_t95
                else:
                    lt_rows[f"T95-{key}"][label] = "-"
            
            # Δv 평균
            if doe_delta_vs:
                avg_delta_v = round(sum(doe_delta_vs) / len(doe_delta_vs), 4)
                lt_rows["ΔV(T95-G)"][label] = avg_delta_v
            else:
                lt_rows["ΔV(T95-G)"][label] = "-"
            
            # 그래프용 평균 시계열 데이터 계산 (모든 메트릭 포함)
            if doe_times_list:
                avg_graph_data = _calculate_average_time_series(
                    doe_times_list, 
                    doe_intensities["white"],
                    doe_intensities["rgb"],
                    doe_intensities["blue_peak"],
                    doe_intensities["vdelta"]
                )
                lt_graph_data[label] = avg_graph_data

    return lt_rows, lt_graph_data


def _calculate_average_time_series(times_list, white_list, rgb_data, blue_peak_list, vdelta_list):
    """
    여러 시계열 데이터의 평균을 계산하는 헬퍼 함수
    rgb_data: {'R': [array1, array2, ...], 'G': [array1, array2, ...], 'B': [array1, array2, ...]} 형태
    """
    if not times_list:
        return {
            "time": [],
            "white": [],
            "red": [],
            "green": [],
            "blue": [],
            "blue_peak": [],
            "vdelta": []
        }
    
    # 공통 시간 축 찾기 (가장 짧은 시계열 기준)
    min_length = min(len(times) for times in times_list)
    common_times = times_list[0][:min_length].tolist()
    
    # 각 시점별 평균 계산
    avg_white = []
    avg_rgb = {"R": [], "G": [], "B": []}
    avg_blue_peak = []
    avg_vdelta = []
    
    for i in range(min_length):
        # White 평균
        white_values = [white_arr[i] for white_arr in white_list if len(white_arr) > i]
        avg_white.append(sum(white_values) / len(white_values) if white_values else 0)
        
        # RGB 평균
		for ch in ["R", "G", "B"]:
		    rgb_values = []
		    if ch in rgb_data:
		        for rgb_array in rgb_data[ch]:
		            if len(rgb_array) > i:
		                value = rgb_array[i]
		                rgb_values.append(value)
		    avg_rgb[ch].append(sum(rgb_values) / len(rgb_values) if rgb_values else 0)
        
        # Blue peak 평균
        blue_peak_values = [bp_arr[i] for bp_arr in blue_peak_list if len(bp_arr) > i]
        avg_blue_peak.append(sum(blue_peak_values) / len(blue_peak_values) if blue_peak_values else 0)
        
        # Vdelta 평균
        vdelta_values = [vd_arr[i] for vd_arr in vdelta_list if len(vd_arr) > i]
        avg_vdelta.append(sum(vdelta_values) / len(vdelta_values) if vdelta_values else 0)
    
    return {
        "time": common_times,
        "white": avg_white,
        "red": avg_rgb["R"],
        "green": avg_rgb["G"], 
        "blue": avg_rgb["B"],
        "blue_peak": avg_blue_peak,
        "vdelta": avg_vdelta
    }


# === 헬퍼 함수들 ===

def _prepare_lt_data(expt: list[dict], expt_spec: list[dict], analyzer: "TVSpectrumAnalyzer") -> tuple[np.ndarray, np.ndarray, dict[str, np.ndarray], np.ndarray, np.ndarray]:
    """LT 데이터 전처리 - RGB 처리 수정"""
    df = pd.DataFrame(expt)
    times = df["[Hour(h)]"].to_numpy()
    vdelta = df["vdelta"].to_numpy() if "vdelta" in df.columns else np.zeros(len(times))

    white = df["[Intensity(%)]"].to_numpy()
    if len(white) > 0 and white[0] != 0:
        white = white / white[0] * 100
    else:
        logger.warning("White intensity 첫 번째 값이 0이거나 데이터가 없음")
        white = np.zeros(len(times))

    # 보간 처리
    expt_spec_interp = []
    valid_indices = []
    
    for i, spec in enumerate(expt_spec):
        try:
            if not spec:
                continue
            first_spec = next(iter(spec.values()))
            if not first_spec:
                continue
            spec_tuple = tuple(first_spec.items())
            intensity_interp = analyzer.get_interpolated_spectrum_cubic(spec_tuple)
            expt_spec_interp.append(intensity_interp)
            valid_indices.append(i)
        except Exception as e:
            logger.error(f"인덱스 {i} 스펙트럼 보간 실패: {e}")
            continue

    if not expt_spec_interp:
        logger.error("보간된 스펙트럼이 없음")
        empty_rgb = {"R": np.zeros(len(times)), "G": np.zeros(len(times)), "B": np.zeros(len(times))}
        return times, white, empty_rgb, np.zeros(len(times)), vdelta

    # RGB 계산 - 수정된 부분
    try:
        rgb_raw = analyzer.calculate_rgb_intensity(expt_spec_interp)
        
        # 정규화된 RGB 딕셔너리 생성
        rgb = {}
        for ch in ["R", "G", "B"]:
            if ch in rgb_raw and "Y" in rgb_raw[ch]:
                y_values = rgb_raw[ch]["Y"]
                if len(y_values) > 0 and y_values[0] != 0:
                    rgb[ch] = y_values / y_values[0] * 100
                else:
                    rgb[ch] = np.zeros(len(expt_spec_interp))
            else:
                rgb[ch] = np.zeros(len(expt_spec_interp))
                
    except Exception as e:
        logger.error(f"RGB 계산 실패: {e}")
        empty_rgb = {"R": np.zeros(len(times)), "G": np.zeros(len(times)), "B": np.zeros(len(times))}
        return times, white, empty_rgb, np.zeros(len(times)), vdelta

    # Blue peak 계산
    try:
        blue_peak = analyzer.calculate_blue_peak(expt_spec_interp)
        if len(blue_peak) > 0 and blue_peak[0] != 0:
            blue_peak = blue_peak / blue_peak[0] * 100
        else:
            blue_peak = np.zeros(len(times))
    except Exception as e:
        logger.error(f"Blue peak 계산 실패: {e}")
        blue_peak = np.zeros(len(times))

    # 데이터 길이 맞추기
    min_length = min(len(times), len(expt_spec_interp))
    times = times[:min_length]
    white = white[:min_length]
    vdelta = vdelta[:min_length]
    
    for ch in ["R", "G", "B"]:
        if len(rgb[ch]) > min_length:
            rgb[ch] = rgb[ch][:min_length]
        elif len(rgb[ch]) < min_length:
            padding = np.full(min_length - len(rgb[ch]), rgb[ch][-1] if len(rgb[ch]) > 0 else 0)
            rgb[ch] = np.concatenate([rgb[ch], padding])
    
    if len(blue_peak) > min_length:
        blue_peak = blue_peak[:min_length]
    elif len(blue_peak) < min_length:
        padding = np.full(min_length - len(blue_peak), blue_peak[-1] if len(blue_peak) > 0 else 0)
        blue_peak = np.concatenate([blue_peak, padding])

    return times, white, rgb, blue_peak, vdelta


def _find_t95(times: np.ndarray, arr: np.ndarray, aging_time: float) -> tuple[float | str, bool]:
    """intensity에서 95% 시점 T95 계산 - 안전성 강화"""
    if len(arr) == 0 or len(times) == 0:
        return "-", False

    # NaN이나 inf 값 처리
    valid_mask = np.isfinite(arr) & np.isfinite(times)
    if not np.any(valid_mask):
        return "-", False
    
    valid_times = times[valid_mask]
    valid_arr = arr[valid_mask]

    # 95 이하인 index 찾기
    below_idx = np.where(valid_arr <= 95)[0]
    if len(below_idx) > 0:
        idx = below_idx[0]
        # 이전 값과 비교해서 95와 더 가까운 쪽 선택
        if idx > 0:
            prev_val = valid_arr[idx - 1]
            curr_val = valid_arr[idx]
            if abs(prev_val - 95) < abs(curr_val - 95):
                idx = idx - 1
        return round(float(valid_times[idx]), 2), False

    # 없으면 aging_time 이후 데이터로 선형 예측
    mask = valid_times >= aging_time
    if np.sum(mask) < 2:
        return "-", True
        
    X = valid_arr[mask].reshape(-1, 1)
    y = valid_times[mask].reshape(-1, 1)
    
    try:
        model = LinearRegression().fit(X, y)
        pred = model.predict(np.array([[95]]))
        predicted_time = float(pred[0][0])
        
        # 예측값이 합리적인 범위인지 확인
        if predicted_time < 0 or predicted_time > valid_times.max() * 10:
            return "-", True
            
        return round(predicted_time, 2), True
    except Exception as e:
        logger.warning(f"T95 예측 실패: {e}")
        return "-", True


def _predict_vdelta(times: np.ndarray, vdelta: np.ndarray, target_time: float) -> float | str:
    """target_time에서 vdelta를 curve_fit으로 예측 - 안전성 강화"""
    if len(times) == 0 or len(vdelta) == 0:
        return "-"
    
    # NaN이나 inf 값 처리
    valid_mask = np.isfinite(times) & np.isfinite(vdelta)
    if np.sum(valid_mask) < 3:  # 2차 곡선 맞추기 위해 최소 3개 점 필요
        return "-"
    
    valid_times = times[valid_mask]
    valid_vdelta = vdelta[valid_mask]
    
    try:
        def poly2(x, a, b, c): 
            return a * x**2 + b * x + c
            
        popt, _ = curve_fit(poly2, valid_times, valid_vdelta, maxfev=5000)
        predicted_value = poly2(target_time, *popt)
        
        # 예측값이 합리적인 범위인지 확인
        if abs(predicted_value) > abs(valid_vdelta.max()) * 10:
            return "-"
            
        return round(float(predicted_value), 4)
    except Exception as e:
        logger.warning(f"Vdelta 예측 실패: {e}")
        return "-"
        
        
# def _store_doe_time_data(times: np.ndarray, white: np.ndarray, rgb: dict, blue_peak: np.ndarray, 
#                         vdelta: np.ndarray, doe_id: int, lt_id: int, doe_time_data: dict) -> None:
#     """DOE별 시간 데이터를 수집하는 함수 - 메모리 효율적"""
    
#     # 데이터 길이 통일
#     lengths = [len(times), len(white), len(vdelta)]
#     rgb_lengths = [len(rgb.get(ch, [])) for ch in ["R", "G", "B"]]
#     blue_peak_length = len(blue_peak)
    
#     min_length = min([l for l in lengths + rgb_lengths + [blue_peak_length] if l > 0])
    
#     if min_length == 0:
#         logger.warning(f"DOE-{doe_id}, LT-{lt_id}: 유효한 데이터가 없음")
#         return
    
#     # 안전한 길이로 데이터 추출
#     safe_times = times[:min_length] if len(times) >= min_length else times
#     safe_white = white[:min_length] if len(white) >= min_length else white
#     safe_vdelta = vdelta[:min_length] if len(vdelta) >= min_length else vdelta
#     safe_blue_peak = blue_peak[:min_length] if len(blue_peak) >= min_length else blue_peak
    
#     safe_rgb = {}
#     for ch in ["R", "G", "B"]:
#         if ch in rgb and len(rgb[ch]) >= min_length:
#             safe_rgb[ch] = rgb[ch][:min_length]
#         else:
#             safe_rgb[ch] = rgb.get(ch, np.zeros(min_length))[:min_length]
    
#     # DOE별로 데이터 저장 (LT ID별로 구분)
#     if doe_id not in doe_time_data:
#         doe_time_data[doe_id] = {}
    
#     doe_time_data[doe_id][lt_id] = {
#         "times": safe_times,
#         "white": safe_white,
#         "rgb": safe_rgb,
#         "blue_peak": safe_blue_peak,
#         "vdelta": safe_vdelta
#     }


# def calculate_doe_time_averages(doe_time_data: dict, doe_labels: list[str]) -> dict:
#     """DOE별 시간 데이터 평균 계산 - 실제 평균 처리"""
#     time_averages = {}
    
#     for label in doe_labels:
#         doe_id = int(label.replace("DOE-", ""))
        
#         if doe_id not in doe_time_data:
#             continue
            
#         lt_data_dict = doe_time_data[doe_id]
        
#         if not lt_data_dict:
#             continue
        
#         # DOE 내 모든 LT 데이터의 시간별 평균 계산
#         all_times_list = []
#         all_data_by_metric = {
#             "white": [],
#             "red": [],
#             "green": [], 
#             "blue": [],
#             "blue_peak": [],
#             "vdelta": []
#         }
        
#         # 각 LT별 데이터 수집
#         for lt_id, lt_data in lt_data_dict.items():
#             times = lt_data["times"]
#             all_times_list.append(times)
            
#             all_data_by_metric["white"].append(lt_data["white"])
#             all_data_by_metric["red"].append(lt_data["rgb"]["R"])
#             all_data_by_metric["green"].append(lt_data["rgb"]["G"])
#             all_data_by_metric["blue"].append(lt_data["rgb"]["B"])
#             all_data_by_metric["blue_peak"].append(lt_data["blue_peak"])
#             all_data_by_metric["vdelta"].append(lt_data["vdelta"])
        
#         if not all_times_list:
#             continue
        
#         # 공통 시간 축 결정 (가장 짧은 시계열 기준)
#         min_length = min(len(times) for times in all_times_list)
#         common_times = all_times_list[0][:min_length]
        
#         # 각 메트릭별 시점별 평균 계산
#         averaged_data = {}
        
#         for metric, data_list in all_data_by_metric.items():
#             averaged_values = []
            
#             for i in range(min_length):
#                 # i번째 시점에서 모든 LT 데이터의 평균
#                 values_at_time_i = []
#                 for data_array in data_list:
#                     if len(data_array) > i:
#                         values_at_time_i.append(data_array[i])
                
#                 if values_at_time_i:
#                     avg_value = sum(values_at_time_i) / len(values_at_time_i)
#                     averaged_values.append(avg_value)
#                 else:
#                     averaged_values.append(0)  # 기본값
            
#             averaged_data[metric] = {
#                 "time": common_times.tolist(),
#                 "values": averaged_values
#             }
        
#         time_averages[label] = averaged_data
    
#     return time_averages
        

    
def calculate_spectrum_averages(spectrum_storage: dict, selected_doe_labels: list[str]) -> dict:
    """DOE별 J10 스펙트럼의 파장별 평균 계산"""
    spectrum_averages = {}
    
    for label in selected_doe_labels:
        if label not in spectrum_storage or not spectrum_storage[label]["J10"]:
            continue
            
        # 해당 DOE의 모든 J10 스펙트럼 데이터
        spectra_list = spectrum_storage[label]["J10"]
        
        if not spectra_list:
            continue
        
        # 모든 스펙트럼을 380~780nm로 보간
        interpolated_spectra = []
        for spec_data in spectra_list:
            if spec_data:
                # 스펙트럼 데이터를 (wavelength, intensity) 튜플로 변환
                spec_tuple = tuple(spec_data.items())
                try:
                    # 380~780nm로 보간
                    intensity_interp = TVSpectrumAnalyzer.get_interpolated_spectrum_cubic(spec_tuple)
                    interpolated_spectra.append(intensity_interp)
                except Exception as e:
                    logger.warning(f"스펙트럼 보간 실패 ({label}): {e}")
                    continue
        
        if not interpolated_spectra:
            continue
        
        # 파장별 평균 계산
        avg_intensities = np.mean(interpolated_spectra, axis=0)
        
        spectrum_averages[label] = {
            "wavelength": WL_INTERP.tolist(),  # 380~780nm
            "intensity": avg_intensities.tolist()
        }
    
    return spectrum_averages
        
class TVSpectrumAnalyzer:
    def __init__(self, color_filter: dict):
        self.color_filter = color_filter
        # 380~780nm, 1nm 간격 precomputed
        self.tri_precomputed = np.array([
            [TRISTIMULUS.get(f"{wl:.1f}", {}).get(a, 0) for a in ["x", "y", "z"]]
            for wl in range(380, 781)
        ])
        self.cf_precomputed = np.array([
            [self.color_filter.get(f"{wl:.1f}", {}).get(ch, 0) for ch in ["r", "g", "b"]]
            for wl in range(380, 781)
        ])

    
    @staticmethod
    @lru_cache(maxsize=256)
    def get_interpolated_spectrum_cubic(spec_tuple: tuple[tuple[str, float], ...]) -> np.ndarray
        wl, intensity = zip(*spec_tuple)  # 키, 값 분리
        wl = np.array(wl, dtype=float)
        intensity = np.array(intensity)
        interp_func = interp1d(wl, intensity, kind="cubic", fill_value="extrapolate")
        intensity_interp = interp_func(WL_INTERP)
        np.maximum(intensity_interp, 0, out=intensity_interp)  # in-place clip
        return intensity_interp


    def calculate_rgb_xyz_batch(self, intensity_list: list[np.ndarray]) -> list[dict]:
        results_list = []
        tri = self.tri_precomputed
        cf_rgb = self.cf_precomputed
    
        for intensity_interp in intensity_list:
            result = {}
            for i, ch in enumerate(["R", "G", "B"]):
                values = cf_rgb[:, i][:, None] * tri * intensity_interp[:, None]
                X, Y, Z = np.sum(values, axis=0)  # trapz 대신 sum (1nm 간격 → dx=1)
                result[f"{ch}_X"], result[f"{ch}_Y"], result[f"{ch}_Z"] = X, Y, Z
            # White
            values = tri * intensity_interp[:, None]
            X, Y, Z = np.sum(values, axis=0)
            result.update({f"W_{a}": v for a, v in zip(["X", "Y", "Z"], (X, Y, Z))})
            results_list.append(result)
    
        return results_list

    def calculate_efficiency_coordinates(self, rgb_xyz: dict, current_density: float = 10.0) -> dict[str, float]:
        """효율 및 색좌표 계산"""
        result = {}
        for ch in ["R", "G", "B", "W"]:
            X, Y, Z = (rgb_xyz.get(f"{ch}_{a}", 0.0) for a in ["X", "Y", "Z"])
            denom = X + Y + Z
            x, y = (round(X / denom, 8), round(Y / denom, 8)) if denom > 0 else ("N/A", "N/A")
            L = Y * 683
            try:
                eff = round(L / current_density / 10, 8)
            except ZeroDivisionError:
                eff = "N/A"
            result[f"{ch}_x"], result[f"{ch}_y"], result[f"{ch}_eff"] = x, y, eff
        return result

      
    def generate_color_table(self, does: list[models.Model], line_factor: models.Model, all_doe_labels: list[str] = None) -> tuple[dict, dict]:
        # 새로운 헬퍼 함수를 사용해서 기본 테이블 구조 생성
        if all_doe_labels:
            doe_labels = all_doe_labels
        else:
            doe_labels = [f"DOE-{doe.id}" for doe in does]
        table_data = tv_generate_base_table("ivl_color", doe_labels)
        
        color_keys = ["R", "G", "B", "W"]
        output_metrics = [f"{ch}_{suffix}" for ch in color_keys for suffix in ["x", "y", "eff"]]
        factor_matrix = line_factor.as_matrix
    
        for doe in does:
            label = f"DOE-{doe.id}"
            j10_ivls = doe.ivl_set.filter(is_J10=True)
            if not j10_ivls.exists():
				continue
    
            result_dict = defaultdict(list)
            expt_spec_list = []  # 모든 보간 데이터 저장
            ivl_list = []        # ivl 매핑 (순서 유지용)
    
            # 1) 먼저 모든 IVL의 스펙트럼을 보간해 모음
            for ivl in j10_ivls:
                expt = ivl.expt
                if not expt or len(expt) != 1:
                    continue
                spec = ivl.expt_spec[0].get("0", {})
                if not spec:
                    continue
                expt_spec_list.append(tuple(spec.items()))
                ivl_list.append(ivl)
    
            if not expt_spec_list:
                continue
    
            # 2) 보간 결과를 일괄 계산
            intensity_list = [self.get_interpolated_spectrum_cubic(spec_tuple) for spec_tuple in expt_spec_list]
            rgb_xyz_list = self.calculate_rgb_xyz_batch(intensity_list)
    
            # 3) 좌표계산 + 라인팩터 적용
            for rgb_xyz in rgb_xyz_list:
                coord_eff = self.calculate_efficiency_coordinates(rgb_xyz)
                for ch in color_keys:
                    factors = factor_matrix[ch]
                    for suffix in ["x", "y", "eff"]:
                        val = coord_eff.get(f"{ch}_{suffix}", "N/A")
                        factor = factors[suffix]
                        adj_val = round(val * factor, 8) if isinstance(val, (int, float)) else "N/A"
                        result_dict[f"{ch}_{suffix}"].append(adj_val)
    
            # 4) 평균값 계산 후 테이블 채움
            for metric in output_metrics:
                suffix = metric.split("_")[-1]
                table_data[metric][label] = get_formatted_avg(result_dict.get(metric, []), suffix)
    
        # Gamut 비율 + 그래프용 데이터
        gamut_data, user_uv_all, color_space_uv = self._calculate_gamut_ratios(table_data, does)
        table_data.update(gamut_data)
    
        graph_data = {
            "cie1976_gamut": CIE1976_GAMUT,
            "user_uv": user_uv_all,
            "ref_uv": color_space_uv
        }
        return table_data, graph_data
    
    
    def _calculate_gamut_ratios(self, color_table: dict, does: list[models.Model]) -> tuple[dict, dict, dict]:
        # 새로운 헬퍼 함수를 사용해서 gamut 비율 테이블 구조 생성
        doe_labels = [f"DOE-{doe.id}" for doe in does]
        # ivl_color의 Main에서 gamut 관련 헤더만 필터링
        gamut_headers = [header for header in tv_get_row_header("ivl_color") 
                        if any(metric in header for metric in ["user_ratio", "overlap_ratio"])]
        
        # 수동으로 gamut_rows 생성 (기본값 포함)
        gamut_rows = {}
        for header in gamut_headers:
            gamut_rows[header] = {"fieldName": header}
            for label in doe_labels:
                gamut_rows[header][label] = "-"
        
        color_space_uv = {n: [TVSpectrumAnalyzer.xy_to_uv(x, y) for x, y in coords] for n, coords in COLOR_SPACE_XY.items()}
        user_uv_all = {}
    
        for doe in does:
            label = f"DOE-{doe.id}"
            if not doe.ivl_set.filter(is_J10=True).exists():
				continue
            user_xy = [(color_table[f"{ch}_x"][label], color_table[f"{ch}_y"][label]) for ch in ["R", "G", "B"]]
            user_uv = [TVSpectrumAnalyzer.xy_to_uv(x, y) for x, y in user_xy]
            user_uv_all[label] = user_uv  # DOE별 좌표 저장
    
            poly_user = Polygon(user_uv)
            user_area = poly_user.area
    
            for name, coords in color_space_uv.items():
                poly_ref = Polygon(coords)
                ref_area = poly_ref.area
                inter_area = poly_user.intersection(poly_ref).area
                gamut_rows[f"{name}-user_ratio"][label] = round(user_area / ref_area, 4)
                gamut_rows[f"{name}-overlap_ratio"][label] = round(inter_area / ref_area, 4)
    
        return gamut_rows, user_uv_all, color_space_uv
    
        
    @staticmethod
    def xy_to_uv(x: float, y: float) -> tuple[float, float]:
        denom = -2 * x + 12 * y + 3
        return (4 * x / denom, 9 * y / denom) if denom != 0 else (0.0, 0.0)


    @staticmethod
    def _get_fwhm(sub_wl, sub_int, peak_val):
        """FWHM 계산 (보조 메서드)"""
        half_max = peak_val / 2
        diffs = np.abs(sub_int - half_max)
        try:
            left_mask = sub_wl < sub_wl[np.argmax(sub_int)]
            left_idx = np.argmin(diffs * left_mask + (~left_mask) * 1e6)
            right_mask = sub_wl > sub_wl[np.argmax(sub_int)]
            right_idx = np.argmin(diffs * right_mask + (~right_mask) * 1e6)
            return round(sub_wl[right_idx] - sub_wl[left_idx], 1)
        except Exception:
            return "N/A"          
            
    @staticmethod
    def analyze_spec(spec_data: dict) -> dict[str, float]:
        """스펙트럼 peak, FWHM 계산"""
        wl = sorted(float(k) for k in spec_data)
        intensity = [float(spec_data.get(str(w), 0.0)) for w in wl]
        interp = interp1d(wl, intensity, kind="linear", fill_value="extrapolate")
        intensity_interp = interp(WL_INTERP)

        def get_peak_info(wl_range, name_prefix, WL_INTERP):
            mask = (WL_INTERP >= wl_range[0]) & (WL_INTERP <= wl_range[1])
            sub_wl, sub_int = WL_INTERP[mask], intensity_interp[mask]
            if len(sub_wl) == 0:
                return {f"{name_prefix} Peak": "N/A", f"{name_prefix} Peak WL": "N/A", f"{name_prefix} FWHM": "N/A"}
            peak_val, peak_wl = np.max(sub_int), sub_wl[np.argmax(sub_int)]
            fwhm = TVSpectrumAnalyzer._get_fwhm(sub_wl, sub_int, peak_val)
            return {f"{name_prefix} Peak": round(peak_val, 3),
                    f"{name_prefix} Peak WL": round(peak_wl, 1),
                    f"{name_prefix} FWHM": round(fwhm, 1) if isinstance(fwhm, numbers.Number) else "N/A"}

        result = {}
        result.update(get_peak_info((380, 500), "B"))
        result.update(get_peak_info((504, 624), "YG"))
        
        # LBL 계산 추가
	    mask_415_455 = (WL_INTERP >= 415) & (WL_INTERP <= 455)
	    mask_400_500 = (WL_INTERP >= 400) & (WL_INTERP <= 500)
	    
	    sum_415_455 = np.sum(intensity_interp[mask_415_455])
	    sum_400_500 = np.sum(intensity_interp[mask_400_500])
	    
	    if sum_400_500 > 0:
	        lbl = round((sum_415_455 / sum_400_500) * 100, 1)
	    else:
	        lbl = "N/A"
	    
	    result["LBL"] = lbl
	    
        return result
            
    def calculate_rgb_intensity(self, expt_spec_interp: list[np.ndarray]) -> dict[str, dict[str, np.ndarray]]:
        """
        Color 분석용 - 기존 함수 그대로 복원
        """
        tri = self.tri_precomputed
        cf_rgb = self.cf_precomputed
        rgb = {ch: {"X": [], "Y": [], "Z": []} for ch in ["R", "G", "B"]}
    
        for vals in expt_spec_interp:
            for i, ch in enumerate(["R", "G", "B"]):
                values = cf_rgb[:, i][:, None] * tri * vals[:, None]
                X, Y, Z = np.sum(values, axis=0)
                rgb[ch]["X"].append(X)
                rgb[ch]["Y"].append(Y * 683)
                rgb[ch]["Z"].append(Z)
    
        # Normalize
        for ch in rgb:
            for axis in ["X", "Y", "Z"]:
                arr = np.array(rgb[ch][axis])
                rgb[ch][axis] = arr / arr[0] * 100 if len(arr) and arr[0] != 0 else np.zeros_like(arr)
        return rgb

    # 2. LT 전용 새 함수 추가
    def calculate_lt_time_series(self, expt_spec_interp: list[np.ndarray]) -> dict[str, np.ndarray]:
        """
        LT 분석 전용 - 시간별 RGB intensity 배열 반환
        """
        tri = self.tri_precomputed
        cf_rgb = self.cf_precomputed
        
        rgb_intensities = {"R": [], "G": [], "B": []}

        for vals in expt_spec_interp:
            for i, ch in enumerate(["R", "G", "B"]):
                # Color filter 적용 후 Y값(luminance) 계산
                filtered_spectrum = cf_rgb[:, i] * vals
                Y_value = np.sum(filtered_spectrum * tri[:, 1])  # Y component만
                rgb_intensities[ch].append(Y_value * 683)  # cd/m2 단위

        # 정규화 (첫 번째 값 기준으로 100%)
        for ch in ["R", "G", "B"]:
            arr = np.array(rgb_intensities[ch])
            if len(arr) > 0 and arr[0] != 0:
                rgb_intensities[ch] = arr / arr[0] * 100
            else:
                rgb_intensities[ch] = np.zeros_like(arr)
        
        return rgb_intensities
    
    
    def calculate_blue_peak(self, expt_spec_interp: list[np.ndarray]) -> np.ndarray:
        if not expt_spec_interp:
            return np.array([])
    
        # 첫 번째 스펙트럼에서 380~540nm 범위 peak index
        sub_range = slice(0, 161)  # 380~540nm
        first_vals = expt_spec_interp[0][sub_range]
        peak_idx = np.argmax(first_vals)
        target_idx = sub_range.start + peak_idx
    
        # 이후 스펙트럼에서 동일 인덱스 intensity 추출
        peaks = [float(vals[target_idx]) for vals in expt_spec_interp]
        return np.array(peaks)
        
    def calculate_rgbw_coordinates(self, spectrum: dict, line_factor: models.Model, 
                                   current_density: float = 10.0) -> dict:
        """스펙트럼 → R,G,B,W x,y 좌표 변환 (단일 데이터)
        
        Args:
            spectrum: {"380.0": intensity, "384.0": intensity, ...} 형태
            line_factor: TVLineFactor 모델 인스턴스
            current_density: 전류밀도 (cd/A 계산용, 기본값 10)
            
        Returns:
            {
                "R_x": 0.640, "R_y": 0.330, "R_eff": 15.2,
                "G_x": 0.300, "G_y": 0.600, "G_eff": 45.8,
                "B_x": 0.150, "B_y": 0.060, "B_eff": 8.3,
                "W_x": 0.313, "W_y": 0.329, "W_eff": 22.1
            }
        """
        # 1) 스펙트럼 보간
        spec_tuple = tuple(spectrum.items())
        intensity_interp = self.get_interpolated_spectrum_cubic(spec_tuple)
        
        # 2) RGB/XYZ 계산
        rgb_xyz_list = self.calculate_rgb_xyz_batch([intensity_interp])
        rgb_xyz = rgb_xyz_list[0]
        
        # 3) 좌표 + 효율 계산
        coord_eff = self.calculate_efficiency_coordinates(rgb_xyz, current_density)
        
        # 4) Line Factor 적용
        factor_matrix = line_factor.as_matrix
        result = {}
        
        for ch in ["R", "G", "B", "W"]:
            factors = factor_matrix[ch]
            for suffix in ["x", "y", "eff"]:
                val = coord_eff.get(f"{ch}_{suffix}", "N/A")
                factor = factors[suffix]
                
                if isinstance(val, (int, float)):
                    result[f"{ch}_{suffix}"] = round(val * factor, 8)
                else:
                    result[f"{ch}_{suffix}"] = "N/A"
        
        return result
    
    
    def calculate_rgbw_coordinates_batch(self, spectra_list: list[dict], 
                                         line_factor: models.Model,
                                         current_density: float = 10.0) -> list[dict]:
        """여러 스펙트럼을 배치로 변환 (성능 최적화 버전)
        
        Args:
            spectra_list: [{"380.0": intensity, ...}, ...] 스펙트럼 리스트
            line_factor: TVLineFactor 모델 인스턴스
            current_density: 전류밀도 (기본값 10)
            
        Returns:
            [{"R_x": ..., "W_y": ..., ...}, ...] 변환 결과 리스트
        """
        if not spectra_list:
            return []
        
        # 1) 모든 스펙트럼 보간
        spec_tuples = [tuple(s.items()) for s in spectra_list]
        intensity_list = [
            self.get_interpolated_spectrum_cubic(st) for st in spec_tuples
        ]
        
        # 2) RGB/XYZ 배치 계산
        rgb_xyz_list = self.calculate_rgb_xyz_batch(intensity_list)
        
        # 3) Line Factor 적용
        factor_matrix = line_factor.as_matrix
        results = []
        
        for rgb_xyz in rgb_xyz_list:
            coord_eff = self.calculate_efficiency_coordinates(rgb_xyz, current_density)
            result = {}
            
            for ch in ["R", "G", "B", "W"]:
                factors = factor_matrix[ch]
                for suffix in ["x", "y", "eff"]:
                    val = coord_eff.get(f"{ch}_{suffix}", "N/A")
                    factor = factors[suffix]
                    
                    if isinstance(val, (int, float)):
                        result[f"{ch}_{suffix}"] = round(val * factor, 8)
                    else:
                        result[f"{ch}_{suffix}"] = "N/A"
            
            results.append(result)
        
        return results


    def generate_j100_wxy_chart_data(self, does: list[models.Model], 
                                     line_factor: models.Model,
                                     all_doe_labels: list[str] = None) -> dict:
        """J100 sweep 데이터의 W,R,G,B x,y를 J별로 계산 (인덱스 기반 평균)
        
        Args:
            does: DOE 모델 리스트
            line_factor: TVLineFactor 모델 인스턴스
            all_doe_labels: 전체 DOE 라벨 리스트 (선택)
            
        Returns:
            {
                "DOE-1": {
                    "j_values": [10.2, 20.5, ..., 100.3],
                    "W_x": [0.313, 0.314, ...],
                    "W_y": [0.329, 0.330, ...],
                    "R_x": [0.640, ...],
                    "R_y": [0.330, ...],
                    "G_x": [0.300, ...],
                    "G_y": [0.600, ...],
                    "B_x": [0.150, ...],
                    "B_y": [0.060, ...]
                },
                "DOE-2": {...}
            }
        """
        # DOE 라벨 필터링
        if all_doe_labels:
            doe_labels_set = set(all_doe_labels)
        else:
            doe_labels_set = {f"DOE-{doe.id}" for doe in does}
        
        result_data = {}
        
        for doe in does:
            label = f"DOE-{doe.id}"
            if label not in doe_labels_set:
                continue
            
            # J100 데이터 필터링 (is_J10=False인 sweep 데이터)
            j100_ivls = doe.ivl_set.filter(is_J10=False)
            if not j100_ivls.exists():
                continue
            
            # 가장 짧은 expt 길이 찾기 (모든 IVL을 동일 길이로 맞추기 위해)
            min_length = min(
                len(ivl.expt) for ivl in j100_ivls 
                if ivl.expt and len(ivl.expt) > 0
            )
            
            if min_length == 0:
                continue
            
            # 인덱스별로 데이터 수집
            j_values = []
            color_data = defaultdict(list)  # {"W_x": [], "W_y": [], ...}
            
            for index in range(min_length):
                # 현재 인덱스의 모든 데이터 수집
                j_at_index = []
                spectra_at_index = []
                
                for ivl in j100_ivls:
                    if not ivl.expt or not ivl.expt_spec:
                        continue
                    
                    # expt에서 J 값 추출
                    if index < len(ivl.expt):
                        entry = ivl.expt[index]
                        j_val = entry.get("J(mA/cm2)")
                        
                        if j_val is None:
                            continue
                        
                        j_at_index.append(float(j_val))
                    else:
                        continue
                    
                    # expt_spec에서 스펙트럼 추출
                    if index < len(ivl.expt_spec):
                        spec_dict = ivl.expt_spec[index]
                        # spec_dict = {"0": {"380.0": ..., "384.0": ...}}
                        # 첫 번째 키의 값을 가져옴 (보통 "0", "1", ... 순서)
                        spec = next(iter(spec_dict.values())) if spec_dict else {}
                        
                        if spec:
                            spectra_at_index.append(spec)
                
                # 유효한 데이터가 없으면 스킵
                if not j_at_index or not spectra_at_index:
                    continue
                
                # J 평균값 계산 (소수점 1자리 반올림)
                j_avg = round(sum(j_at_index) / len(j_at_index), 1)
                j_values.append(j_avg)
                
                # 스펙트럼 배치 처리로 RGBW 좌표 계산
                rgbw_results = self.calculate_rgbw_coordinates_batch(
                    spectra_at_index, 
                    line_factor,
                    current_density=j_avg  # 현재 전류밀도 사용
                )
                
                # 각 metric별 평균 계산
                for metric in ["W_x", "W_y", "R_x", "R_y", "G_x", "G_y", "B_x", "B_y"]:
                    values = [
                        r[metric] for r in rgbw_results 
                        if r[metric] != "N/A"
                    ]
                    
                    if values:
                        avg_val = sum(values) / len(values)
                        color_data[metric].append(round(avg_val, 6))
                    else:
                        color_data[metric].append(None)
            
            # 결과 저장 (J값 기준 정렬)
            if j_values:
                # J값 기준으로 모든 리스트 함께 정렬
                sorted_indices = sorted(range(len(j_values)), key=lambda i: j_values[i])
                
                result_data[label] = {
                    "j_values": [j_values[i] for i in sorted_indices],
                    **{k: [v[i] for i in sorted_indices] for k, v in color_data.items()}
                }
        
        return result_data