from dvmt.models import (
    AC3Meas,
    EllipsometerMeas,
    PLMeas,
    PLQYMeas,
    UVVISMeas,
)

def get_pl_data(sample_ids):
    pl_data = PLMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []

    for item in pl_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'wavelength': item.wavelength,
            'pl_normdata': item.pl_normdata,
        })

    return data_list

def pl_chart(data_list, sample_ids):
    all_wavelengths = sorted(set(wl for data in data_list for wl in data['wavelength']))
    datasets = []

    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            wavelength = data['wavelength']
            pl_normdata = data['pl_normdata']
            data_dict = dict(zip(wavelength, pl_normdata))

            intensity_values = [data_dict.get(wl, None) for wl in all_wavelengths]

            datasets.append({
                'label': mat_name,
                'data': [{'x': wl, 'y': y} for wl, y in zip(all_wavelengths, intensity_values)],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })

    return {'x': all_wavelengths, 'datasets': datasets}

def get_plqy_data(sample_ids):
    plqy_data = PLQYMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []

    for item in plqy_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'wavelength': item.plqy_wavelength,
            'plqy_refdata': item.plqy_refdata,
            'plqy_sampledata': item.plqy_sampledata,
        })

    return data_list

def plqy_chart(data_list, sample_ids):
    all_wavelengths = sorted(set(wl for data in data_list for wl in data['wavelength']))
    datasets = []

    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            plqy_wavelength = data['wavelength']
            plqy_refdata = data['plqy_refdata']
            plqy_sampledata = data['plqy_sampledata']

            datasets.append({
                'label': f"{mat_name} Ref",
                'data': [{'x': wl, 'y': y} for wl, y in zip(plqy_wavelength, plqy_refdata)],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })

            datasets.append({
                'label': f"{mat_name} Sample",
                'data': [{'x': wl, 'y': y} for wl, y in zip(plqy_wavelength, plqy_sampledata)],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })

    return {'x': all_wavelengths, 'datasets': datasets}

def get_uvvis_data(sample_ids):
    uvvis_data = UVVISMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []

    for item in uvvis_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'uvvis_wavelength': item.uvvis_wavelength,
            'uvvis_corrected_data': item.uvvis_corrected_data,
            'uvvis_slope': item.uvvis_slope,
            'uvvis_intercept': item.uvvis_intercept,
            'uvvis_x_intercept': item.uvvis_x_intercept,
        })

    return data_list

def uvvis_chart(data_list, sample_ids):
    all_wavelengths = sorted(set(wl for data in data_list for wl in data['uvvis_wavelength']))
    datasets = []

    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            uvvis_wavelength = data['uvvis_wavelength']
            uvvis_corrected_data = data['uvvis_corrected_data']
            uvvis_slope = data['uvvis_slope']
            uvvis_intercept = data['uvvis_intercept']
            uvvis_x_intercept = data['uvvis_x_intercept']

            datasets.append({
                'label': f"{mat_name} Corrected Data",
                'data': [{'x': wl, 'y': y} for wl, y in zip(uvvis_wavelength, uvvis_corrected_data)],
                'sample_id': sample_id,
                'pointRadius': 0,
                'yAxisID': 'y',
                'axisScale': 'yes'
            })

            fitted_line_values = [
                {'x': wl, 'y': y}
                for wl in all_wavelengths
                if (y := uvvis_slope * wl + uvvis_intercept) > -1
            ]
            datasets.append({
                'label': f"{mat_name} Fitted Line",
                'data': fitted_line_values,
                'sample_id': sample_id,
                'borderDash': [5, 5],
                'pointRadius': 0,
                'yAxisID': 'y',
                'is_trendline': True,
            })

            datasets.append({
                'label': f"{mat_name} X-Intercept",
                'data': [{'x': uvvis_x_intercept, 'y': 0}],
                'sample_id': sample_id,
                'fill': False,
                'borderColor': 'orange',
                'backgroundColor': 'orange',
                'type': 'scatter',
                'showLine': False,
                'pointRadius': 4,
                'yAxisID': 'y',
                'is_trendline': True,
            })

    return {'x': all_wavelengths, 'datasets': datasets}
    
def get_ac3_data(sample_ids):
    ac3_data = AC3Meas.objects.filter(sample_id__in=sample_ids)
    data_list = []

    for item in ac3_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'ac3_ev': item.ac3_ev,
            'ac3_yield020': item.ac3_yield020,
            'ac3_slope': item.ac3_slope,
            'ac_intercept': item.ac_intercept,
            'ac3_baseline': item.ac3_baseline,
        })

    return data_list

def ac3_chart(data_list, sample_ids):
    all_ac3_ev = sorted(set(ev for data in data_list for ev in data['ac3_ev']))
    datasets = []

    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            ac3_ev = data['ac3_ev']
            ac3_yield020 = data['ac3_yield020']
            ac3_slope = data['ac3_slope']
            ac_intercept = data['ac_intercept']
            ac3_baseline = data['ac3_baseline']

            fitted_line_values = [{'x': ev, 'y': ac3_slope * ev + ac_intercept} for ev in all_ac3_ev]
            baseline_values = [{'x': ev, 'y': ac3_baseline} for ev in all_ac3_ev]

            datasets.append({
                'label': f"{mat_name} Yield020",
                'data': [{'x': ev, 'y': y} for ev, y in zip(ac3_ev, ac3_yield020)],
                'sample_id': sample_id,
                'fill': False,
                'borderColor': 'blue',
                'yAxisID': 'y',
            })

            datasets.append({
                'label': f"{mat_name} Fitted Line",
                'data': fitted_line_values,
                'sample_id': sample_id,
                'fill': False,
                'type': 'line',
                'pointRadius': 0,
                'borderDash': [5, 5],
                'yAxisID': 'y',
            })

            datasets.append({
                'label': f"{mat_name} Baseline",
                'data': baseline_values,
                'sample_id': sample_id,
                'fill': False,
                'borderDash': [5, 5],
                'yAxisID': 'y',
            })

    return {'x': all_ac3_ev, 'datasets': datasets}

def get_ellipsometer_data(sample_ids):
    ellipso_data = EllipsometerMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []

    for item in ellipso_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'ellipso_wavelength': item.ellipso_wavelength,
            'ellipso_n': item.ellipso_n,
            'ellipso_k': item.ellipso_k,
        })

    return data_list

def ellipsometer_chart(data_list, sample_ids):
    all_wavelengths = sorted(set(wl for data in data_list for wl in data['ellipso_wavelength']))
    datasets = []

    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            ellipso_wavelength = data['ellipso_wavelength']
            ellipso_n = data['ellipso_n']
            ellipso_k = data['ellipso_k']

            datasets.append({
                'label': f"{mat_name} n",
                'data': [{'x': wl, 'y': y} for wl, y in zip(ellipso_wavelength, ellipso_n)],
                'sample_id': sample_id,
                'yAxisID': 'y',
            })

            datasets.append({
                'label': f"{mat_name} k",
                'data': [{'x': wl, 'y': y} for wl, y in zip(ellipso_wavelength, ellipso_k)],
                'sample_id': sample_id,
                'fill': False,
                'borderDash': [5, 5],
                'yAxisID': 'y2',
            })

    return {'x': all_wavelengths, 'datasets': datasets}
    
    
def get_ltpl_data(sample_ids):
    """
    선택된 sample_ids에 해당하는 LTPL 측정 데이터를 가져옵니다.
    
    Args:
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        list: 각 샘플의 LTPL 데이터를 담은 딕셔너리 리스트.
    """
    ltpl_data = LTPLMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []
    
    for item in ltpl_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'ltpl_wavelength_77k': item.ltpl_wavelength_77k,
            'ltpl_rawdata_77k': item.ltpl_rawdata_77k,
            'ltpl_wavelength_289k': item.ltpl_wavelength_289k,
            'ltpl_rawdata_289k': item.ltpl_rawdata_289k,
        })
    
    return data_list

def ltpl_chart(data_list, sample_ids):
    """
    LTPL 데이터를 그래프 형식으로 변환.
    
    Args:
        data_list (list): 각 샘플의 LTPL 데이터를 담은 딕셔너리 리스트.
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        dict: 그래프 생성에 필요한 데이터를 담은 딕셔너리.
    """
    datasets = []
    
    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
    
            # 77K 데이터 추가
            datasets.append({
                'label': f"{mat_name} 77K",
                'data': [{'x': wl, 'y': y} for wl, y in zip(data['ltpl_wavelength_77k'], data['ltpl_rawdata_77k'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })
    
            # 289K 데이터 추가
            datasets.append({
                'label': f"{mat_name} 289K",
                'data': [{'x': wl, 'y': y} for wl, y in zip(data['ltpl_wavelength_289k'], data['ltpl_rawdata_289k'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })
    
    return {'datasets': datasets}

def get_trpl_data(sample_ids):
    """
    선택된 sample_ids에 해당하는 TRPL 측정 데이터를 가져옵니다.
    
    Args:
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        list: 각 샘플의 TRPL 데이터를 담은 딕셔너리 리스트.
    """
    trpl_data = TRPLMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []
    
    for item in trpl_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'trpl_time': item.trpl_time,
            'trpl_emission_data': item.trpl_emission_data,
        })
    
    return data_list

def trpl_chart(data_list, sample_ids):
    """
    TRPL 데이터를 그래프 형식으로 변환.
    
    Args:
        data_list (list): 각 샘플의 TRPL 데이터를 담은 딕셔너리 리스트.
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        dict: 그래프 생성에 필요한 데이터를 담은 딕셔너리.
    """
    datasets = []
    
    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            datasets.append({
                'label': f"{mat_name}",
                'data': [{'x': t, 'y': y} for t, y in zip(data['trpl_time'], data['trpl_emission_data'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
            })
    
    return {'datasets': datasets}

def get_cv_data(sample_ids):
    """
    선택된 sample_ids에 해당하는 CV 측정 데이터를 가져옵니다.
    동일 sample_id의 HOD/EOD 데이터를 하나의 딕셔너리로 병합합니다.
    """
    cv_data = CVMeas.objects.filter(sample_id__in=sample_ids)
    data_dict_by_sample = {}
    
    for item in cv_data:
        sample_id = item.sample_id
        
        if sample_id not in data_dict_by_sample:
            data_dict_by_sample[sample_id] = {
                'sample_id': sample_id,
                'material_name': item.sample.material.mat_name,
                'cv_vbias': item.cv_vbias,
            }
        
        if item.cv_device_structure == "HOD":
            data_dict_by_sample[sample_id]['cv_posi_capdata'] = item.cv_capdata
        elif item.cv_device_structure == "EOD":
            data_dict_by_sample[sample_id]['cv_nega_capdata'] = item.cv_capdata
    
    return list(data_dict_by_sample.values())

def cv_chart(data_list, sample_ids):
    """
    CV 데이터를 그래프 형식으로 변환.
    전체 데이터에서 posi/nega 유무에 따라 축 배치 결정.
    """
    datasets = []
    
    # 전체 데이터에서 posi/nega 존재 여부 확인
    any_posi = any('cv_posi_capdata' in item for item in data_list)
    any_nega = any('cv_nega_capdata' in item for item in data_list)
    
    has_y2 = False
    # 축 배치 결정
    # 둘 다 있으면: posi → y, nega → y2
    # 하나만 있으면: 해당 데이터 → y
    if any_posi and any_nega:
        posi_axis = 'y'
        nega_axis = 'y2'
        has_y2 = True
    else:
        posi_axis = 'y'
        nega_axis = 'y'
    
    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if not data:
            continue
        
        mat_name = data['material_name']
        vbias = data['cv_vbias']
        
        if 'cv_posi_capdata' in data:
            datasets.append({
                'label': f"{mat_name} (HOD)",
                'data': [{'x': v, 'y': c} for v, c in zip(vbias, data['cv_posi_capdata'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': posi_axis,
            })
        
        if 'cv_nega_capdata' in data:
            datasets.append({
                'label': f"{mat_name} (EOD)",
                'data': [{'x': v, 'y': c} for v, c in zip(vbias, data['cv_nega_capdata'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': nega_axis,
            })
    
    return {'datasets': datasets, 'has_y2': has_y2}

def get_iv_data(sample_ids):
    """
    선택된 sample_ids에 해당하는 IV 측정 데이터를 가져옵니다.
    
    Args:
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        list: 각 샘플의 IV 데이터를 담은 딕셔너리 리스트.
    """
    iv_data = IVMeas.objects.filter(sample_id__in=sample_ids)
    data_list = []
    
    for item in iv_data:
        data_list.append({
            'sample_id': item.sample_id,
            'material_name': item.sample.material.mat_name,
            'iv_sqrt_e': item.iv_sqrt_e,
            'iv_fit_mobility': item.iv_fit_mobility,
        })
    
    return data_list

def iv_chart(data_list, sample_ids):
    """
    IV 데이터를 그래프 형식으로 변환 (Y축 로그 스케일 적용).
    
    Args:
        data_list (list): 각 샘플의 IV 데이터를 담은 딕셔너리 리스트.
        sample_ids (list): 선택된 샘플 ID 리스트.
    
    Returns:
        dict: 그래프 생성에 필요한 데이터를 담은 딕셔너리.
    """
    datasets = []
    
    for sample_id in sample_ids:
        data = next((item for item in data_list if item['sample_id'] == sample_id), None)
        if data:
            mat_name = data['material_name']
            datasets.append({
                'label': f"{mat_name}",
                'data': [{'x': e, 'y': m} for e, m in zip(data['iv_sqrt_e'], data['iv_fit_mobility'])],
                'sample_id': sample_id,
                'chart_type': 'line',
                'fill': False,
                'yAxisID': 'y',
                'yAxisScale': 'log',  # ✅ 기본값 log 스케일
            })
    
    return {'datasets': datasets}


    