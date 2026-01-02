from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from scipy.optimize import minimize
import numpy as np
from dvmt.models import (
    AC3Meas, PLMeas, UVVISMeas, EllipsometerMeas, LTPLMeas, TRPLMeas, CVMeas, IVMeas, FittingResult
    )
from dvmt.utils.json_loader_utils import (
    calculate_ac3_baseline, calculate_ac3_intersection, calculate_ac3_slope_parameters,
    calculate_peak_wavelength, calculate_uvvis_fitting, calculate_first_peak_wavelength,
    calculate_tau
    )
    
@receiver(post_save, sender=AC3Meas)
def calculate_ac3_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        ac3_ev = instance.ac3_ev
        ac3_yield020 = instance.ac3_yield020
        
        if ac3_ev and ac3_yield020:
            baseline = calculate_ac3_baseline(instance.ac3_yield020)
            intersection_ev = calculate_ac3_intersection(ac3_ev, ac3_yield020, baseline)
            slope, intercept = calculate_ac3_slope_parameters(ac3_ev, ac3_yield020, baseline)
            
            instance.ac3_baseline = baseline
            instance.ac3_slope = slope
            instance.ac3_intercept = intercept
            
            instance.save(update_fields=['ac3_baseline', 'ac3_slope', 'ac3_intercept'])
            
            fitting_result, created = FittingResult.objects.get_or_create(
                # mat_name = instance.sample.material.mat_name,
                # pd_equip = instance.sample.pd_equip,
                sample = instance.sample,
                defaults={
                    # 'sample': instance.sample,
                    'created_by': instance.created_by,
                    'ac3_intersection_ev': intersection_ev
                    }
                )
            if not created:
                fitting_result.ac3_intersection_ev = intersection_ev
                fitting_result.save(update_fields=['ac3_intersection_ev'])
                
@receiver(post_save, sender=PLMeas)
def calculate_pl_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        pl_normdata = instance.pl_normdata
        pl_wavelength = instance.pl_wavelength
        
        if pl_normdata and pl_wavelength:
            peak_wavelength = calculate_peak_wavelength(pl_normdata, pl_wavelength)
            
            fitting_result, created = FittingResult.objects.get_or_create(
                # mat_name = instance.sample.material.mat_name,
                # pd_equip = instance.sample.pd_equip,
                sample = instance.sample,
                defaults={
                    # 'sample': instance.sample,
                    'created_by': instance.created_by,
                    'pl_peak_wavelength' : peak_wavelength
                    }
                )            if not created:
                fitting_result.pl_peak_wavelength = peak_wavelength
                fitting_result.save(update_fields=['pl_peak_wavelength'])
                
@receiver(post_save, sender=UVVISMeas)
def calculate_uvvis_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        uvvis_wavelength = instance.uvvis_wavelength
        uvvis_rawdata = instance.uvvis_rawdata
        
        if uvvis_wavelength and uvvis_rawdata:
            corrected_data, slope, intercept, x_intercept, bandgap = calculate_uvvis_fitting(uvvis_wavelength, uvvis_rawdata)
            
            instance.uvvis_corrected_data = corrected_data
            instance.uvvis_slope = slope
            instance.uvvis_intercept = intercept
            instance.uvvis_x_intercept = x_intercept
            instance.save(update_fields=['uvvis_corrected_data', 'uvvis_slope', 'uvvis_intercept', 'uvvis_x_intercept'])
            
            fitting_result, created = FittingResult.objects.get_or_create(
                # mat_name = instance.sample.material.mat_name,
                # pd_equip = instance.sample.pd_equip,
                sample = instance.sample,
                defaults={
                    # 'sample': instance.sample,
                    'created_by': instance.created_by,
                    'uvvis_bandgap' : bandgap
                    }
                )
            if not created:
                fitting_result.uvvis_bandgap= bandgap
                fitting_result.save(update_fields=['uvvis_bandgap'])
                
@receiver(post_save, sender=LTPLMeas)
def calculate_ltpl_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        ltpl_rawdata_77k = instance.ltpl_rawdata_77k
        ltpl_wavelength_77k = instance.ltpl_wavelength_77k
        
        if ltpl_rawdata_77k and ltpl_wavelength_77k:
            peak_wavelength = calculate_first_peak_wavelength(ltpl_rawdata_77k, ltpl_wavelength_77k)
            cal_value = 1240 / peak_wavelength
            
            if peak_wavelength == 1:
                cal_value = None
            
            fitting_result, created = FittingResult.objects.get_or_create(
                # mat_name = instance.sample.material.mat_name,
                # pd_equip = instance.sample.pd_equip,
                sample = instance.sample,
                defaults={
                    # 'sample': instance.sample,
                    'created_by': instance.created_by,
                    'ltpl_triplet_energy' : cal_value
                    }
                )
            if not created:
                fitting_result.ltpl_triplet_energy = cal_value
                fitting_result.save(update_fields=['ltpl_triplet_energy'])
                
                
@receiver(post_save, sender=TRPLMeas)
def calculate_trpl_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        trpl_time = instance.trpl_time
        trpl_area = instance.trpl_area
        
        if trpl_time and trpl_area:
            prompt_tau, delayed_tau = calculate_tau(trpl_time, trpl_area)
            prompt_tau = prompt_tau * 1000
            
            fitting_result, created = FittingResult.objects.get_or_create(
                # mat_name = instance.sample.material.mat_name,
                # pd_equip = instance.sample.pd_equip,
                sample = instance.sample,
                defaults={
                    # 'sample': instance.sample,
                    'created_by': instance.created_by,
                    'trpl_prompt_tau' : prompt_tau,
                    'trpl_delayed_tau' : delayed_tau
                    }
                )
            if not created:
                fitting_result.trpl_prompt_tau= prompt_tau
                fitting_result.trpl_delayed_tau= delayed_tau
                fitting_result.save(update_fields=['trpl_prompt_tau', 'trpl_delayed_tau'])
                

@receiver(post_save, sender=CVMeas)
def calculate_cv_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        device_area = 0.0009  # cm^2
        vacuum_permittivity = 8.854187818E-12  # F/m

        cv_vbias = instance.cv_vbias
        cv_capdata = instance.cv_capdata
        cv_total_thickness = instance.cv_total_thickness * 1.0e-8  # nm → m

        zero_idx = cv_vbias.index(0)
        cv_zerocap = cv_capdata[zero_idx]
        cv_maxcap = max(cv_capdata)
        cv_permittivity = (cv_zerocap * cv_total_thickness) / (device_area * vacuum_permittivity)

        # 이 부분만 변경
        structure = instance.cv_device_structure.strip()  # 'HOD' 또는 'EOD'
        defaults = {
            'created_by': instance.created_by,
        }

        if structure == 'HOD':
            defaults.update({
                'cv_h_zerocap': cv_zerocap,
                'cv_h_maxcap': cv_maxcap,
                'cv_h_permittivity': cv_permittivity,
            })
        elif structure == 'EOD':
            defaults.update({
                'cv_e_zerocap': cv_zerocap,
                'cv_e_maxcap': cv_maxcap,
                'cv_e_permittivity': cv_permittivity,
            })

        fitting_result, created = FittingResult.objects.get_or_create(
            sample=instance.sample,
            defaults=defaults
        )

        if not created and defaults:
            for key, value in defaults.items():
                setattr(fitting_result, key, value)
            fitting_result.save(update_fields=defaults.keys())                
                
@receiver(post_save, sender=IVMeas)
def calculate_iv_data(sender, instance, **kwargs):
    if kwargs.get('created', False):
        emission_area = 0.0009
        ampere_rescale = 1000
        iv_vbi = 0.0009
        iv_q = 1.6e-19
        iv_mu_zero = 1.0e-2
        iv_device_structure = instance.iv_device_structure  # 수정 기준이 되는 필드
        iv_nv_for_hod = 1.0e21
        iv_nc_for_eod = 3.0e21

        if iv_device_structure == "HOD":  # 수정X
            iv_nv_or_nc = iv_nv_for_hod
        else:
            iv_nv_or_nc = iv_nc_for_eod

        q_n_mu = iv_q * iv_mu_zero * iv_nv_or_nc
        thermal_voltage = 0.0259

        iv_vbias = instance.iv_vbias
        iv_idata = instance.iv_idata
        iv_total_thickness = instance.iv_total_thickness

        zero_index = iv_vbias.index(0)
        end_index = iv_vbias.index(6.0)
        iv_vbias_filtered = [round(v,1) for v in iv_vbias[zero_index+1:end_index]]
        iv_idata_filtered = iv_idata[zero_index+1:end_index]

        iv_E = [(v-iv_vbi)/iv_total_thickness for v in iv_vbias_filtered]
        iv_E_root = [np.sqrt(v) for v in iv_E]

        iv_jdata_filtered = [abs(v/emission_area*ampere_rescale) for v in iv_idata_filtered]
        j_array = np.array(iv_jdata_filtered)
        e_array = np.array(iv_E)
        e_root_array = np.array(iv_E_root)

        def objective(params):
            iv_vbi, fit_data1_slope, fit_data1_y_intercept = params
            iv_E = [(v-iv_vbi)/iv_total_thickness for v in iv_vbias_filtered]
            iv_E_root = [np.sqrt(v) for v in iv_E]
            exp_data1_array = np.log(j_array/(q_n_mu*e_array))
            fit_data1_array = (e_root_array*fit_data1_slope)+fit_data1_y_intercept
            error1 = (exp_data1_array-fit_data1_array)**2

            min_sum = float('inf')
            for i in range(len(error1)-29):
                current_sum = np.sum(error1[i:i+30])
                if current_sum < min_sum:
                    min_sum = current_sum
            return min_sum

        initial_guess = [0.0, 1.0e-3, -10.0]
        bounds = [(0,None), (None,None), (None,None)]
        result = minimize(objective, initial_guess, bounds=bounds)

        iv_vbi_opt, fit_data1_slope_opt, fit_data1_y_intercept_opt = result.x

        iv_E_opt = [(v-iv_vbi_opt)/iv_total_thickness for v in iv_vbias_filtered]
        iv_E_root_opt = [np.sqrt(v) for v in iv_E_opt]
        e_array_opt = np.array(iv_E_opt)
        e_root_array_opt = np.array(iv_E_root_opt)

        alpha = thermal_voltage * fit_data1_y_intercept_opt + 0.1
        alpha_plus_delta = alpha - 0.1
        jv_fit_array = q_n_mu * e_array_opt * np.exp(((alpha_plus_delta/thermal_voltage)+(fit_data1_slope_opt*e_root_array_opt)))
        iv_jv_fit = jv_fit_array.tolist()

        fit_mobility_array = iv_mu_zero * np.exp(((alpha/thermal_voltage)+(fit_data1_slope_opt*e_root_array_opt)))
        fit_mobility = fit_mobility_array.tolist()

        instance.iv_vbias = iv_vbias_filtered
        instance.iv_idata = iv_idata_filtered
        instance.iv_jdata = iv_jdata_filtered
        instance.iv_sqrt_e = iv_E_root_opt
        instance.iv_jv_fit = iv_jv_fit
        instance.iv_fit_mobility = fit_mobility

        instance.save()

        cal_value1 = (-0.1) * alpha
        cal_value2 = fit_data1_slope_opt * thermal_voltage
        cal_value3 = iv_mu_zero * np.exp((alpha/thermal_voltage))

        # 기존 Sample.device_structure → 수정: instance.iv_device_structure 기준으로 분기
        if iv_device_structure == 'HOD':  # ← 수정된 분기 기준
            defaults = {
                'created_by': instance.created_by,
                'iv_h_activation_energy': cal_value1,
                'iv_h_pg_factor': cal_value2,
                'iv_h_zero_field_mobility': cal_value3
            }
        elif iv_device_structure == 'EOD':  # ← 수정된 분기 기준
            defaults = {
                'created_by': instance.created_by,
                'iv_e_activation_energy': cal_value1,
                'iv_e_pg_factor': cal_value2,
                'iv_e_zero_field_mobility': cal_value3
            }
        else:
            defaults = {
                'created_by': instance.created_by
            }

        fitting_result, created = FittingResult.objects.get_or_create(
            sample=instance.sample,
            defaults=defaults
        )

        if not created and defaults:
            for key, value in defaults.items():
                setattr(fitting_result, key, value)
            fitting_result.save(update_fields=defaults.keys())

@receiver(post_save, sender=EllipsometerMeas)
def save_ellipsometer_status(sender, instance, **kwargs):
   fitting_result, created = FittingResult.objects.get_or_create(
        # mat_name = instance.sample.material.mat_name,
        # pd_equip = instance.sample.pd_equip,
        sample = instance.sample,
        defaults={
        #   'sample': instance.sample,
           'created_by': instance.created_by,
           'ellipso_is': True
        }
    ) 
    if not created:
        fitting_result.ellipso_is = True
        fitting_result.save()
        

@receiver(post_delete, sender=EllipsometerMeas)
def set_ellipsometer_status_false(sender, instance, **kwargs):
    try:
        fitting_result, created = FittingResult.objects.get_or_create(
            # mat_name = instance.sample.material.mat_name,
            # pd_equip = instance.sample.pd_equip,
            sample = instance.sample,
            defaults={
            #   'sample': instance.sample,
              'created_by': instance.created_by,
              'ellipso_is': False
            }
        )
        fitting_result.save()
        
    except FittingResult.DoesNotExist:
        pass
    
    
@receiver(post_delete, sender=AC3Meas)
@receiver(post_delete, sender=PLMeas)
@receiver(post_delete, sender=UVVISMeas)
def clear_fitting_result_field_on_delete(sender, instance, **kwargs):
    field_map={
        AC3Meas: 'ac3_intersection_ev',
        PLMeas: 'pl_peak_wavelength',
        UVVISMeas: 'uvvis_bandgap',
    }
    
    try:
        fitting_result = FittingResult.objects.get(sample=instance.sample)
        field_to_clear = field_map.get(sender)
        if field_to_clear:
            setattr(fitting_result, field_to_clear, None)
            fitting_result.save(update_fields=[field_to_clear])
    except FittingResult.DoesNotExist:
        pass
            
            
            
            