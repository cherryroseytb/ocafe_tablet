import numpy as np
from collections import defaultdict
from django.db import models
import logging

# 기존 imports...
from pao.utils.pivot_table import (
    tv_get_ivl_labels,
    tv_generate_ivl_table,
    tv_generate_angle_table,
    tv_generate_lt_table,
    calculate_spectrum_averages,
    calculate_angle_spectrum_averages,
    TVSpectrumAnalyzer,
    calculate_area_from_first_points,
    recalculate_current_density
)
from pao.models import TVColorFilter, TVLineFactor

logger = logging.getLogger(__name__)

# Plotly 차트 색상 코드
COLORCODE = [
    #생략, chart-main.js의 CHART_COLORS와 약간 다름
]

class TVPlotlyProcessor:
    """TV 차트용 Plotly 데이터 및 레이아웃 처리 클래스"""
    
    def __init__(self):
        self.color_index = 0
        
        # 각 차트별 레이아웃 정의
        self.jv_layout = {
            "title": {"text": "J-V 특성"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {
                "title": "Voltage (V)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "yaxis": {
                "title": "Current Density (mA/cm²)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
        }
        
        self.cj_layout = {
            "title": {"text": "Current Efficiency"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {
                "title": "Current Density (mA/cm²)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "yaxis": {
                "title": "Current Efficiency (cd/A)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
        }
        
        self.spectrum_layout = {
            "title": {"text": "Spectrum"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {
                "title": "Wavelength (nm)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "yaxis": {
                "title": "Intensity",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
        }
        
        self.wxy_layout = {
            "title": {"text": "White x,y vs J"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {
                "title": "Current Density (mA/cm²)",
                "showgrid": True,
                "gridcolor": "lightgray"
            },
            "yaxis": {
                "title": "CIE x",
                "showgrid": True,
                "gridcolor": "lightgray",
                "side": "left"
            },
            "yaxis2": {
                "title": "CIE y",
                "showgrid": True,
                "gridcolor": "lightgray",
                "side": "right",
                "overlaying": "y"
            },
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
        }
        
        # 나머지 6개 차트 레이아웃도 동일하게 정의
        self.angular_spectrum_layout = {
            "title": {"text": "Angular Spectrum"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "Wavelength (nm)", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "Intensity", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
        
        self.delta_uv_angle_layout = {
            "title": {"text": "Δu'v' vs Angle"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "Angle (degree)", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "Δu'v'", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
        
        self.lt_layout = {
            "title": {"text": "Lifetime"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "Time (hour)", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "Intensity (%)", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
        
        self.delta_v_layout = {
            "title": {"text": "ΔV vs Time"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "Time (hour)", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "ΔV", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
        
        self.color_coordinate_layout = {
            "title": "Color Coordinates",
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "CIE x", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "CIE y", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
        
        self.delta_u_delta_v_layout = {
            "title": {"text": "Δu'-Δv' Angle"},
            "font": {"family": "Arial, sans-serif", "size": 12},
            "xaxis": {"title": "Δu'", "showgrid": True, "gridcolor": "lightgray"},
            "yaxis": {"title": "Δv'", "showgrid": True, "gridcolor": "lightgray"},
            "showlegend": True,
            "legend": {"x": 0.7, "y": 0.95},
            "margin": {"t": 40, "b": 40, "l": 50, "r": 50},
            "height": 300
        }
    
    def get_next_color(self):
        """다음 색상 반환"""
        color = COLORCODE[self.color_index % len(COLORCODE)]
        self.color_index += 1
        return color
    
    def get_all_layouts(self):
        """모든 레이아웃 반환"""
        return {
            "tv-jv-chart": self.jv_layout,
            "tv-cj-chart": self.cj_layout,
            "tv-spectrum-chart": self.spectrum_layout,
            "tv-wxy-chart": self.wxy_layout,
            "tv-angular-spectrum-chart": self.angular_spectrum_layout,
            "tv-delta-uv-angle-chart": self.delta_uv_angle_layout,
            "tv-lt-chart": self.lt_layout,
            "tv-delta-v-chart": self.delta_v_layout,
            "tv-color-coordinate-chart": self.color_coordinate_layout,
            "tv-delta-u-delta-v-chart": self.delta_u_delta_v_layout
        }
        
        
def generate_jv_chart_data(does: list[models.Model], selected_doe_labels: list[str]) -> dict:
    """1. J-V 차트 데이터 생성 (J100 sweep 데이터, DOE별 평균)"""
    traces = []
    
    valid_ids = {int(label.split("-")[-1]) for label in selected_doe_labels}
    filtered_does = [doe for doe in does if doe.id in valid_ids]
    
    for doe in filtered_does:
        label = f"DOE-{doe.id}"
        j100_vals = doe.ivl_set.filter(is_J10=False)
        if not j100_vals.exists():
            continue
            
        all_expt_data = []
        for ivl in j100_vals:
            if ivl.expt:
                # [변경] 앞쪽 3개 포인트로 면적 계산
                area = calculate_area_from_first_points(ivl.expt, ivl.id)
                if area is None:
                    continue
                
                # [변경] 전류 기반으로 모든 포인트의 전류밀도 재계산
                recalculated_expt = recalculate_current_density(ivl.expt, area)
                all_expt_data.append(recalculated_expt)
                
        if not all_expt_data:
            continue
        
        # [변경] min_length → max_length로 변경
        max_length = max(len(expt) for expt in all_expt_data)
        
        j_values, v_values = [], []
        
        for i in range(max_length):
            j_at_index = []
            v_at_index = []
            
            for expt in all_expt_data:
                if i < len(expt):  # [변경] 인덱스 범위 체크 추가
                    entry = expt[i]
                    j = entry.get("J(mA/cm2)")
                    v = entry.get("V(volt)")
                    
                    if j is not None and v is not None:
                        j_at_index.append(float(j))
                        v_at_index.append(float(v))
                        
            if j_at_index and v_at_index:
                avg_j = sum(j_at_index) / len(j_at_index)
                avg_v = sum(v_at_index) / len(v_at_index)
                j_values.append(round(avg_j, 2))  # [변경] 소수점 둘째자리 반올림
                v_values.append(avg_v)
        
        if j_values and v_values:
            sorted_data = sorted(zip(v_values, j_values), key=lambda x: x[0])
            v_sorted, j_sorted = zip(*sorted_data)
            traces.append({
                "x": list(v_sorted),
                "y": list(j_sorted),
                "name": label,
                "mode": "lines+markers"
            })
    
    return {"traces": traces}




def generate_cj_chart_data(does: list[models.Model], selected_doe_labels: list[str]) -> dict:
    """2. cd/A-J 차트 데이터 생성 (인덱스 기반 평균)"""
    traces = []
    
    valid_ids = {int(label.split("-")[-1]) for label in selected_doe_labels}
    filtered_does = [doe for doe in does if doe.id in valid_ids]
    
    for doe in filtered_does:
        label = f"DOE-{doe.id}"
        j100_vals = doe.ivl_set.filter(is_J10=False)
        if not j100_vals.exists():
            continue
        
        # DOE별 모든 expt 데이터 수집
        all_expt_data = []
        for ivl in j100_vals:
            if ivl.expt:
                all_expt_data.append(ivl.expt)
        
        if not all_expt_data:
            continue
        
        # 가장 짧은 expt 길이 기준으로 통일
        min_length = min(len(expt) for expt in all_expt_data)
        
        j_values, ce_values = [], []
        
        # 인덱스별로 평균 계산
        for i in range(min_length):
            j_at_index = []
            ce_at_index = []
            
            for expt in all_expt_data:
                entry = expt[i]
                j = entry.get("J(mA/cm2)")
                ce = entry.get("CE(cd/A)")
                
                if j is not None and ce is not None:
                    j_at_index.append(float(j))
                    ce_at_index.append(float(ce))
            
            # 해당 인덱스에서의 평균값 계산
            if j_at_index and ce_at_index:
                avg_j = sum(j_at_index) / len(j_at_index)
                avg_ce = sum(ce_at_index) / len(ce_at_index)
                
                if avg_j == 0 and avg_ce == 0:
                    continue
                
                j_values.append(avg_j)
                ce_values.append(avg_ce)
        
        if j_values and ce_values:
            traces.append({
                "x": j_values,   # X축: Current Density (평균값)
                "y": ce_values,  # Y축: Current Efficiency (평균값)
                "name": label,
                "mode": "lines+markers"
            })
    
    return {"traces": traces}


def generate_spectrum_chart_data(spectrum_storage: dict, selected_doe_labels: list[str]) -> dict:
    """3. Spectrum 차트 데이터 생성 (J10 데이터, spectrum_storage 활용)"""
    traces = []
    
    # 기존 calculate_spectrum_averages 함수 활용
    spectrum_averages = calculate_spectrum_averages(spectrum_storage, selected_doe_labels)
    
    for label in selected_doe_labels:
        if label in spectrum_averages:
            traces.append({
                "x": spectrum_averages[label]["wavelength"],  # 380~780nm
                "y": spectrum_averages[label]["intensity"],
                "name": label,
                "type": "scatter",
                "mode": "lines"
            })
    
    return {"traces": traces}





def generate_wxy_chart_data(does: list[models.Model], 
                            selected_doe_labels: list[str],
                            color_filter: dict,
                            line_factor: models.Model) -> dict:
    """4. Wx,y-J 차트 데이터 생성 (J100 sweep, Color Filter/Line Factor 적용)
    
    Args:
        does: DOE 모델 리스트
        selected_doe_labels: 선택된 DOE 라벨 리스트
        color_filter: TVColorFilter.rgb_data (딕셔너리)
        line_factor: TVLineFactor 모델 인스턴스
        
    Returns:
        {"traces": [...]}  # W/R/G/B의 x/y 좌표 (총 8개 trace)
    """
    traces = []
    
    # DOE 필터링
    valid_ids = {int(label.split("-")[-1]) for label in selected_doe_labels}
    filtered_does = [doe for doe in does if doe.id in valid_ids]
    
    # TVSpectrumAnalyzer 인스턴스 생성
    analyzer = TVSpectrumAnalyzer(color_filter)
    
    # J100 Wxy 데이터 생성
    wxy_data = analyzer.generate_j100_wxy_chart_data(
        filtered_does, 
        line_factor, 
        selected_doe_labels
    )
    
    # 컬러별 trace 생성 (W, R, G, B 각각 x/y)
    # ✅ JS 필터와 호환되도록 전체 색상 이름 사용
    colors = {
        "W": "White",
        "R": "Red", 
        "G": "Green",
        "B": "Blue"
    }
    
    for label in selected_doe_labels:
        if label not in wxy_data:
            continue
        
        doe_data = wxy_data[label]
        j_values = doe_data["j_values"]
        
        for color_code, color_name in colors.items():
            # ✅ White만 초기 표시
            is_white = (color_code == "W")
            
            # x 좌표 trace (Y축 - 왼쪽)
            x_key = f"{color_code}_x"
            if x_key in doe_data and doe_data[x_key]:
                traces.append({
                    "x": j_values,
                    "y": doe_data[x_key],
                    "name": f"{label} - {color_name}_x",
                    "mode": "lines+markers",
                    "type": "scatter",
                    "yaxis": "y",          # ✅ Y축 명시
                    "visible": is_white    # ✅ 초기 visible 설정
                })
            
            # y 좌표 trace (Y2축 - 오른쪽)
            y_key = f"{color_code}_y"
            if y_key in doe_data and doe_data[y_key]:
                traces.append({
                    "x": j_values,
                    "y": doe_data[y_key],
                    "name": f"{label} - {color_name}_y",
                    "mode": "lines+markers",
                    "type": "scatter",
                    "yaxis": "y2",         # ✅ Y2축 사용
                    "visible": is_white    # ✅ 초기 visible 설정
                })
    
    return {"traces": traces}



def generate_angular_spectrum_chart_data(angles: list[models.Model], filtered_doe_labels: list[str]) -> dict:
    """5. Angular Spectrum 차트 데이터 생성 (DOE별 각도별 평균)"""
    traces = []
    
    # DOE별로 angle 데이터 그룹핑
    doe_angle_groups = defaultdict(list)
    for angle in angles:
        doe_angle_groups[angle.doe.id].append(angle)
    
    for doe_id, angle_list in doe_angle_groups.items():
        label = f"DOE-{doe_id}"
        
        if label not in filtered_doe_labels:
            continue
        
        # DOE 내 각도별 스펙트럼 강도값 수집 (파장별)
        angle_intensity_collection = defaultdict(lambda: defaultdict(list))  # {각도: {파장: [강도값들]}}
        common_wavelengths = None
        
        for angle in angle_list:
            expt = angle.expt
            expt_spec = angle.expt_spec
            if not expt or not expt_spec:
                continue
            
            # 각 angle 데이터에서 각도별 스펙트럼 추출
            for entry, spec in zip(expt, expt_spec):
                try:
                    filename = entry.get("filename", "")
                    degree = int(filename.split("(")[-1].replace(")", ""))
                    
                    # 스펙트럼 데이터 추출
                    spectrum_dict = None
                    if isinstance(spec, dict):
                        # {"0": {"380.0": 0.001, ...}} 형태
                        first_key = next(iter(spec.keys()))
                        spectrum_dict = spec[first_key]
                    
                    if spectrum_dict and isinstance(spectrum_dict, dict):
                        # 첫 번째 스펙트럼에서 파장 리스트 가져오기 (한 번만)
                        if common_wavelengths is None:
                            common_wavelengths = sorted([float(wl) for wl in spectrum_dict.keys() 
                                                       if str(wl).replace(".", "").isdigit()], key=float)
                        
                        # 각 파장별 강도값 수집
                        for wl in common_wavelengths:
                            wl_str = str(wl)
                            if wl_str in spectrum_dict:
                                try:
                                    intensity = float(spectrum_dict[wl_str])
                                    angle_intensity_collection[degree][wl].append(intensity)
                                except (ValueError, TypeError):
                                    continue
                        
                except (ValueError, KeyError):
                    continue
        
        # 각도별 평균 스펙트럼 계산 및 trace 생성
        for degree in sorted(angle_intensity_collection.keys()):
            intensity_by_wl = angle_intensity_collection[degree]
            
            # 파장별 평균 강도 계산
            avg_intensities = []
            for wl in common_wavelengths:
                intensity_list = intensity_by_wl.get(wl, [])
                if intensity_list:
                    avg_intensity = sum(intensity_list) / len(intensity_list)
                    avg_intensities.append(avg_intensity)
                else:
                    avg_intensities.append(0)  # 데이터가 없으면 0
            
            if avg_intensities:
                traces.append({
                    "x": common_wavelengths,
                    "y": avg_intensities,
                    "name": f"{label}_{degree}°",
                    "type": "scatter",
                    "mode": "lines"
                })
    
    return {"traces": traces}


def generate_delta_uv_angle_chart_data(angle_averages: dict, all_doe_labels: list[str]) -> dict:
    """6. Δu'v'-Angle 차트 데이터 생성"""
    traces = []
    
    for label in all_doe_labels:
        if label in angle_averages:
            traces.append({
                "x": angle_averages[label]["angle"],
                "y": angle_averages[label]["delta_uv"],
                "name": label,
                "type": "scatter",
                "mode": "lines+markers"
            })
    
    return {"traces": traces}


def generate_lt_chart_data(lt_graph_data: dict, selected_doe_labels: list[str]) -> dict:
    """7. LT 차트 데이터 생성 (Plotly 기본 색상 사용)"""
    traces = []
    
    # ✅ color 속성 제거 - Plotly 기본 팔레트 사용
    color_map = {
        "white": "White",
        "red": "Red",
        "green": "Green",
        "blue": "Blue"
    }
    
    for label in selected_doe_labels:
        if label not in lt_graph_data:
            continue
            
        doe_data = lt_graph_data[label]
        time_values = doe_data.get("time", [])
        
        for color_key, color_name in color_map.items():
            if color_key in doe_data:
                values = doe_data[color_key]
                traces.append({
                    "x": time_values,
                    "y": values,
                    "name": f"{label}_{color_name}",
                    "type": "scatter",
                    "mode": "lines+markers",
                    # ✅ "line": {"color": ...} 제거 → Plotly 자동 색상 적용
                    "visible": color_key == "white",  # White만 기본 표시
                })
    
    return {"traces": traces}


def generate_delta_v_chart_data(time_averages: dict, selected_doe_labels: list[str]) -> dict:
    """8. ΔV 차트 데이터 생성"""
    traces = []
    
    for label in selected_doe_labels:
        if label in time_averages and "vdelta" in time_averages[label]:
            vdelta_data = time_averages[label]["vdelta"]
            traces.append({
                "x": vdelta_data["time"],
                "y": vdelta_data["values"],
                "name": label,
                "type": "scatter",
                "mode": "lines+markers"
            })
    
    return {"traces": traces}


def generate_color_coordinate_chart_data(color_table_data: dict, selected_doe_labels: list[str]) -> dict:
    """9. 색좌표 차트 데이터 생성 (W/R/G/B 모두 포함)"""
    traces = []
    
    color_config = {
        "W": {"name": "White", "symbol": "circle"},
        "R": {"name": "Red", "symbol": "square"},
        "G": {"name": "Green", "symbol": "diamond"},
        "B": {"name": "Blue", "symbol": "triangle-up"}
    }
    
    for label in selected_doe_labels:
        for color_key, config in color_config.items():
            x_key = f"{color_key}_x"
            y_key = f"{color_key}_y"
            
            x_val = color_table_data.get(x_key, {}).get(label, "-")
            y_val = color_table_data.get(y_key, {}).get(label, "-")
            
            if x_val != "-" and y_val != "-":
                try:
                    traces.append({
                        "x": [float(x_val)],
                        "y": [float(y_val)],
                        "name": f"{label}_{config['name']}",
                        "type": "scatter",
                        "mode": "markers",
                        "marker": {
                            "size": 10,
                            "symbol": config["symbol"]
                        },
                        "visible": color_key == "W"  # White만 기본 표시
                    })
                except (ValueError, TypeError):
                    continue
    
    return {"traces": traces}

def generate_delta_u_delta_v_chart_data(angles: list[models.Model], all_doe_labels: list[str]) -> dict:
    """10. Δu'-Δv' Angle 차트 데이터 생성 (DOE별 평균, 실제 u'v' 좌표 기반)"""
    traces = []
    
    # DOE별로 angle 데이터 그룹핑
    doe_angle_groups = defaultdict(list)
    for angle in angles:
        doe_angle_groups[angle.doe.id].append(angle)
    
    for doe_id, angle_list in doe_angle_groups.items():
        label = f"DOE-{doe_id}"
        
        if label not in all_doe_labels:
            continue
        
        # DOE 내 모든 angle 데이터에서 각도별 u'v' 좌표 수집
        angle_uv_collection = defaultdict(list)  # {각도: [(u', v'), (u', v'), ...]}
        
        for angle in angle_list:
            expt = angle.expt
            if not expt:
                continue
            
            # 각 angle 데이터에서 각도별 u'v' 추출
            for entry in expt:
                try:
                    filename = entry.get("filename", "")
                    degree = int(filename.split("(")[-1].replace(")", ""))
                    x, y = float(entry.get("x", 0)), float(entry.get("y", 0))
                    u, v = TVSpectrumAnalyzer.xy_to_uv(x, y)
                    angle_uv_collection[degree].append((u, v))
                except (ValueError, KeyError):
                    continue
        
        # 0도 기준점이 없으면 스킵
        if 0 not in angle_uv_collection:
            continue
        
        # 각도별 u'v' 평균 계산
        angle_uv_avg = {}
        for degree, uv_list in angle_uv_collection.items():
            if not uv_list:
                continue
            avg_u = sum(uv[0] for uv in uv_list) / len(uv_list)
            avg_v = sum(uv[1] for uv in uv_list) / len(uv_list)
            angle_uv_avg[degree] = (avg_u, avg_v)
        
        # 0도 기준점
        u0, v0 = angle_uv_avg[0]
        
        # 각 각도별 델타 u', 델타 v' 계산 (실제 차이값 - 음수 가능)
        delta_u_values, delta_v_values = [], []
        angles_list = []
        
        for degree in sorted(angle_uv_avg.keys()):
            u, v = angle_uv_avg[degree]
            delta_u = u - u0  # 실제 차이값 (음수 가능)
            delta_v = v - v0  # 실제 차이값 (음수 가능)
            
            delta_u_values.append(delta_u)
            delta_v_values.append(delta_v)
            angles_list.append(degree)
        
        if delta_u_values and delta_v_values:
            traces.append({
                "x": delta_u_values,
                "y": delta_v_values,
                "text": [f"{label}_{deg}°" for deg in angles_list],
                "name": label,
                "type": "scatter",
                "mode": "lines+markers",
                "marker": {"size": 6}
            })
    
    return {"traces": traces}
    
def tv_process_deltav_baseline_upload(label: str, file, request: HttpRequest) -> tuple[bool, str]:
    """
    Delta V 기준선 TXT 파일 처리
    형식: Lifetime(H)\tVoltage Delta
          0\t0
          1\t5.2
    """
    try:
        content = file.read().decode("utf-8")
        lines = content.strip().split("\n")
        
        if len(lines) < 2:
            return False, "파일에 데이터가 부족합니다."
        
        header = lines[0]
        
        baseline_data = {}
        for i, line in enumerate(lines[1:], start=2):
            parts = line.strip().split()
            
            if len(parts) != 2:
                return False, f"{i}번째 줄 형식 오류: 2개 컬럼 필요"
            
            try:
                time_val = float(parts[0])
                delta_v = float(parts[1])
                baseline_data[str(time_val)] = delta_v
            except ValueError:
                return False, f"{i}번째 줄: 숫자 변환 실패"
        
        if not baseline_data:
            return False, "유효한 데이터가 없습니다."
        
        # 중복 체크 (colorfilter와 동일하게)
		if TVDeltaVBaseline.objects.filter(label=label, created_user=request.user).exists():
		    return (False, f"[{label}]은 이미 존재합니다. 기존 항목을 삭제한 후 다시 업로드 해주세요.")
		
		TVDeltaVBaseline.objects.create(
		    label=label,
		    baseline_data=baseline_data,
		    created_user=request.user,
		    ip=get_client_ip(request)[0]
		)
		
		return True, f"'{label}' 기준선이 생성되었습니다. ({len(baseline_data)}개 데이터 포인트)"
        
    except Exception as e:
        logger.error(f"Delta V 기준선 처리 오류: {str(e)}", exc_info=True)
        return False, f"파일 처리 중 오류: {str(e)}"