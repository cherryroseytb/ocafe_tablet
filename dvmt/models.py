from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.conf import settings
from datetime import datetime
from typing import Dict

ELECTRODE_PRESETS = {
    'ITO': {
        'work_function': -4.7,
        'color': '#FFD700',
        'category': 'Anode'
    },
    'Al': {
        'work_function': -4.3,
        'color': '#C0C0C0',
        'category': 'Cathode'
    },
    'Ag': {
        'work_function': -4.5,
        'color': '#E8E8E8',
        'category': 'Cathode'
    },
    'Mg:Ag': {
        'work_function': -3.7,
        'color': '#D3D3D3',
        'category': 'Cathode'
    },
    'LiF/Al': {
        'work_function': -2.8,
        'color': '#B8B8B8',
        'category': 'Cathode'
    },
    'Au': {
        'work_function': -5.1,
        'color': '#FFD700',
        'category': 'Anode'
    },
}

# TimestampedModel: 공통 필드 정의
class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        abstract = True

# Material 모델
class Material(TimestampedModel):
    class Meta:
        ordering = ["-pk"]
        
    mat_name = models.CharField(max_length=50, unique=True)    
    mat_code = models.CharField(max_length=255, blank=True)
    mass_type = models.CharField(max_length=255, blank=True)
    maker = models.CharField(max_length=255, blank=True)
    manual_input = models.CharField(blank=True)

    def __str__(self):
        return self.mat_name

# Sample 모델
class Sample(TimestampedModel):
    material = models.ForeignKey(Material, on_delete=models.CASCADE)
    pd_equip = models.CharField(max_length=100)  # 제작 장비
    ms_equip = models.CharField(max_length=100)  # 측정 장비
    pd_date = models.DateField()  # 제작일
    ms_date = models.DateField()  # 측정일
    device_classification = models.CharField(max_length=255)
    device_structure = models.CharField(max_length=255)
    totl_thickness = models.FloatField(null=True)

    def __str__(self):
        return self.material.mat_name
        
# FittingResult 모델
class FittingResult(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    # mat_name = models.CharField(max_length=50)
    # pd_equip = models.CharField(max_length=255)
    
    ac3_intersection_ev = models.FloatField(null=True)  # AC3 결과
    pl_peak_wavelength = models.FloatField(null=True)
    plqy_value = models.FloatField(null=True)
    uvvis_bandgap = models.FloatField(null=True)  # UVVIS 결과
    ellipso_is = models.BooleanField(null=True)
    ltpl_triplet_energy = models.FloatField(null=True)
    trpl_prompt_tau = models.FloatField(null=True)
    trpl_delayed_tau = models.FloatField(null=True)
    cv_h_zerocap = models.FloatField(null=True)
    cv_e_zerocap = models.FloatField(null=True)
    cv_h_maxcap = models.FloatField(null=True)
    cv_e_mapcap = models.FloatField(null=True)
    cv_h_permittivity = models.FloatField(null=True)  # CV 결과
    cv_e_permittivity = models.FloatField(null=True)  
    iv_h_activation_energy = models.FloatField(null=True)
    iv_e_activation_energy = models.FloatField(null=True)
    iv_h_pf_factor = models.FloatField(null=True)
    iv_e_pf_factor = models.FloatField(null=True)
    iv_h_zero_field_mobilty = models.FloatField(null=True)
    iv_e_zero_field_mobilty = models.FloatField(null=True)
    
    class Meta:
        # unique_together = ('mat_name', 'pd_equip')
        unique_together = ('sample',) 
        
    def save(self, *args, **kwargs):
        if not self.created_by:
            self.created_by = kwargs.pop('user'), None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"FittingResult_{self.sample.material.mat_name}"        
        

# AC3Meas 모델
class AC3Meas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    ac3_ev = ArrayField(models.FloatField, null=True)  # 에너지 값
    ac3_yield025 = ArrayField(models.FloatField, null=True)  # 수율 값
    ac3_yield020 = ArrayField(models.FloatField, null=True)  # 수율 값
    ac3_slope = models.FloatField(null=True)  # 기울기
    ac3_intercept = models.FloatField(null=True)  # 절편
    ac3_baseline = models.FloatField(null=True)  # 기준선
    
    def __str__(self):
        return f"{self.sample,material.mat_name}_{self.sample.ms_equip}"
        
        
    @classmethod
    def from_dict(cls, data, user, ip_address) -> 'AC3Meas':
        material, created = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )
        
        sample, _ = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('ac3_pd_equip'),
            ms_equip = data.get('ac3_ms_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('ac3_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('ac3_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )
        
        return cls.objects.get_or_create(
            sample = sample,
            defaults={
                'ac3_ev' : [float(w) for w in data.get('ac3_ev', [])],
                'ac3_yield025' : [float(w) for w in data.get('ac3_yield025', [])],
                'ac3_yield020' : [float(w) for w in data.get('ac3_yield020', [])],
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]



# Ellipsometer 측정 테이블
class EllipsometerMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    ellipso_mse = models.FloatField(null=True)
    ellipso_thickness = models.FloatField(null=True)
    ellipso_wavelength = ArrayField(models.FloatField(), null=True)
    ellipso_n = ArrayField(models.FloatField(), null=True)
    ellipso_k = ArrayField(models.FloatField(), null=True)
    
    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data, user, ip_address) -> EllipsometerMeas:
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )
        
        sample, _ = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('ellipso_pd_equip'),
            ms_equip = data.get('ellipso_ms_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('ellipso_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('ellipso_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.objects.get_or_create(
            sample = sample,
            defaults = {
                'ellipso_mse' : float(data.get('ellipso_mse')) if data.get('ellipso_mse') is not None else None,
                'ellipso_thickness' : float(data.get('ellipso_thickness')) if data.get('ellipso_thickness') is not None else None,
                'ellipso_wavelength' : [float(w) for w in data.get('ellipso_wavelength', [])],
                'ellipso_n' : [float(w) for w in data.get('ellipso_n', [])],
                'ellipso_k' : [float(w) for w in data.get('ellipso_k', [])],
                'created_by' : user,
                'ip' : ip_address,
            }    
        )[0]
                
                        
            
# PL 측정 테이블
class PLMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    pl_wavelength = ArrayField(models.FloatField(), null=True)
    pl_rawdata = ArrayField(models.FloatField(), null=True)
    pl_normdata = ArrayField(models.FloatField(), null=True)
    
    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"
    
    @classmethod
    def from_dict(cls, data: Dict, user, ip_address) -> "PLMeas":
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'), 
            defaults={
                'ip': ip_address, 
                'created_by': user
              }
        )
        
        sample, _ = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('pl_pd_equip'),
            ms_equip = data.get('pl_ms_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('pl_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('pl_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.object.get_or_create(
            sample = sample,
            defaults={
                'pl_wavelength' : [float(w) for w in data.get('pl_wavelength', [])],
                'pl_rawdata' : [float(w) for w in data.get('pl_rawdata', [])],
                'pl_normdata' : [float(w) for w in data.get('pl_normdata', [])],
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]


# PLQY 측정 테이블
class PLQYMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    plqy_cursor1 = models.FloatField()
    plqy_cursor2 = models.FloatField()
    plqy_cursor3 = models.FloatField()
    plqy_cursor4 = models.FloatField()
    plqy_wavelength = ArrayField(models.FloatField(), null=True)
    plqy_refdata = ArrayField(models.FloatField(), null=True)
    plqy_sampledata = ArrayField(models.FloatField(), null=True)
    
    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data:dict, user, ip_address:str) -> 'PLQYMeas':
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )

        sample, _ = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('plqy_pd_equip'),
            ms_equip = data.get('plqy_ms_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('plqy_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('plqy_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.object.get_or_create(
            sample = sample,
            defaults={
                'plqy_cursor1' : float(data.get('plqy_cursor1')),
                'plqy_cursor2' : float(data.get('plqy_cursor2')),
                'plqy_cursor3' : float(data.get('plqy_cursor3')),
                'plqy_cursor4' : float(data.get('plqy_cursor4')),
                'plqy_wavelength' : [float(w) for w in data.get('plqy_wavelength', [])],
                'plqy_refdata' : [float(w) for w in data.get('plqy_refdata', [])],
                'plqy_smapledata' : [float(w) for w in data.get('plqy_sampledata', [])],
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]


# UVVISMeas 모델
class UVVISMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    uvvis_wavelength = ArrayField(models.FloatField(), null=True)  # 파장 데이터
    uvvis_rawdata = ArrayField(models.FloatField(), null=True)  # 원본 데이터
    uvvis_corrected_data = ArrayField(models.FloatField(), null=True)  # 보정된 데이터
    uvvis_slope = models.FloatField(null=True)
    uvvis_intercept = models.FloatField(null=True)
    uvvis_x_intercept = models.FloatField(null=True)

    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data:dict, user, ip_address:str) -> 'UVVISMeas':
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )

        sample, _ = Sample.objects.get_or_create(
            material = material,
            ms_equip = data.get('uvvis_ms_equip'),
            pd_equip = data.get('uvvis_pd_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('uvvis_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('uvvis_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.object.get_or_create(
            sample = sample,
            defaults={
                'uvvis_wavelength' : [float(w) for w in data.get('uvvis_wavelength', [])],
                'uvvis_rawdata' : [float(w) for w in data.get('uvvis_refdata', [])],
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]
        
        

# LTPLMeas 모델
class LTPLMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    ltpl_wavelength_77k = ArrayField(models.FloatField(), null=True)  # 77K 파장 데이터
    ltpl_rawdata_77k = ArrayField(models.FloatField(), null=True)  # 77K 데이터
    ltpl_wavelength_289k = ArrayField(models.FloatField(), null=True)  # 289K 파장 데이터
    ltpl_rawdata_289k = ArrayField(models.FloatField(), null=True)  # 289K 데이터
    ltpl_solvent = models.CharField(max_length=255, null=True, blank=True)  # 용매 정보

    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data: dict, user, ip_address: str) -> 'LTPLMeas':
        """
        LTPL 데이터에서 Sample을 찾아 저장하는 함수.

        Args:
            data (dict): 파싱된 LTPL 데이터.
            user: 생성한 사용자.
            ip_address (str): 요청한 IP 주소.

        Returns:
            LTPLMeas: 생성되거나 업데이트된 LTPLMeas 객체.
        """

        # Material과 Sample 객체 가져오기
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={'created_by': user, 'ip': ip_address}
        )

        sample, _ = Sample.objects.get_or_create(
            material=material,
            ms_equip=data.get('ltpl_ms_equip'),
            pd_equip=data.get('ltpl_pd_equip'),
            defaults={
                'pd_date': datetime.strptime(data.get('ltpl_pd_date'), '%Y-%m-%d').date(),
                'ms_date': datetime.strptime(data.get('ltpl_ms_date'), '%Y-%m-%d').date(),
                'created_by': user,
                'ip': ip_address,
            }
        )

        # LTPL 데이터 저장 (77K, 289K 동시에 저장)
        return cls.objects.get_or_create(
            sample=sample,
            defaults={
                'ltpl_wavelength_77k': [float(w) for w in data.get('ltpl_wavelength_77k', [])] if 'ltpl_wavelength_77k' in data else None,
                'ltpl_rawdata_77k': [float(w) for w in data.get('ltpl_rawdata_77k', [])] if 'ltpl_rawdata_77k' in data else None,
                'ltpl_wavelength_289k': [float(w) for w in data.get('ltpl_wavelength_289k', [])] if 'ltpl_wavelength_289k' in data else None,
                'ltpl_rawdata_289k': [float(w) for w in data.get('ltpl_rawdata_289k', [])] if 'ltpl_rawdata_289k' in data else None,
                'ltpl_solvent': data.get('ltpl_solvent'),
                'created_by': user,
                'ip': ip_address,
            }
        )[0]
        

# TRPLMeas 모델
class TRPLMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    trpl_chi = models.FloatField(null=True),
    trpl_emwl = models.FloatField(null=True),
    trpl_time = ArrayField(models.FloatField(), null=True)
    trpl_area = ArrayField(models.FloatField(), null=True)
    trpl_time_us = ArrayField(models.FloatField(), null=True)
    trpl_emission_data = ArrayField(models.FloatField(), null=True)

    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data:dict, user, ip_address:str) -> 'TRPLMeas':
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )

        sample, _ = Sample.objects.get_or_create(
            material = material,
            ms_equip = data.get('trpl_ms_equip'),
            pd_equip = data.get('trpl_pd_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('trpl_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('trpl_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.object.get_or_create(
            sample = sample,
            defaults={
                'trpl_chi' : data.get('trpl_chi'),
                'trpl_emwl' : data.get('trpl_emwl'),
                'trpl_time' : [float(w) for w is not None else none for w in data.get('trpl_time', [])],
                'trpl_area' : [float(w) for w is not None else none for w in data.get('trpl_area', [])],
                'trpl_time_us' : [float(w) for w in data.get('trpl_time_us', [])],
                'trpl_emission_data' : [float(w) for w in data.get('trpl_emission_data', [])],
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]


# CVMeas 모델
class CVMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    cv_device_classification = models.CharField(max_length=255)
    cv_device_structure = models.CharField(max_length=255)
    cv_aclevel = models.FloatField(null=True),
    cv_frequency = models.FloatField(null=True),
    cv_total_thickness = models.FloatField(null=True),
    cv_vbias = ArrayField(models.FloatField(), null=True)
    cv_capdata = ArrayField(models.FloatField(), null=True)
    cv_device_structure_detail = models.JSONField()

    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data:dict, user, ip_address:str) -> 'CVMeas':
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )

        sample, created = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('cv_pd_equip'),
            ms_equip = data.get('cv_ms_equip'),
            defaults={
                'pd_data' : datetile.strptime(data.get('cv_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('cv_ms_date'), '%Y-%m-%d').date(),
                'devcie_classification' : data.get('cv_device_classification'),
                # 'device_structure' : data.get('cv_device_structure'),
                'created_by' : user,
                'ip' : ip_address,
            }
        )
        
        updated_fields = []
        if not created:
            # 기존 구조 분리
            current_structures = set(sample.device_structure.split(','))
            new_structures = set(data.get('cv_device_structure').split(','))
        
            if not new_structures.issubset(current_structures):
                sample.device_structure = ",".join(sorted(current_structures.union(new_structures)))
                updated_fields.append('device_structure')
        
            # classification 업데이트
            if sample.device_classification != data.get('cv_device_classification'):
                sample.device_classification = data.get('cv_device_classification')
                updated_fields.append('device_classification')
        
            if updated_fields:
                sample.save(update_fields=updated_fields)

        # ✅ 정확한 최종 코드 (통일성 유지)
        return cls.objects.get_or_create(
            sample=sample,
            cv_device_structure=data.get('cv_device_structure'),
            defaults={
                'cv_device_classification': data.get('cv_device_classification'),
                'cv_aclevel': float(data.get('cv_aclevel', 0)),
                'cv_frequency': float(data.get('cv_frequency', 0)),
                'cv_total_thickness': float(data.get('cv_total_thickness', 0)),
                'cv_vbias': [float(w) if w is not None else None for w in data.get('cv_vbias', [])],
                'cv_capdata': [float(w) if w is not None else None for w in data.get('cv_capdata', [])],
                'cv_device_structure_detail': data.get('device_structure_detail'),
                'created_by': user,
                'ip': ip_address,
            }
        )[0]


# IVMeas 모델
class IVMeas(TimestampedModel):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE)
    iv_device_classification = models.CharField(max_length=255)
    iv_device_structure = models.CharField(max_length=255)
    iv_total_thickness = models.FloatField(null=True),
    iv_vbias = ArrayField(models.FloatField(), null=True)
    iv_idata = ArrayField(models.FloatField(), null=True)
    iv_jdata = ArrayField(models.FloatField(), null=True)
    iv_sqrt_e = ArrayField(models.FloatField(), null=True)
    iv_jv_fit = ArrayField(models.FloatField(), null=True)
    iv_fit_mobility = ArrayField(models.FloatField(), null=True)
    iv_device_structure_detail = models.JSONField()

    def __str__(self):
        return f"{self.sample.material.mat_name}_{self.sample.ms_equip}"

    @classmethod
    def from_dict(cls, data:dict, user, ip_address:str) -> 'IVMeas':
        material, _ = Material.objects.get_or_create(
            mat_name=data.get('mat_name'),
            defaults={
                'created_by': user, 
                'ip': ip_address
            }
        )

        sample, _ = Sample.objects.get_or_create(
            material = material,
            pd_equip = data.get('iv_pd_equip'),
            ms_equip = data.get('iv_ms_equip'),
            device_classification = data.get('iv_device_classification'),
            device_structure = data.get('iv_device_structure'),
            defaults={
                'pd_data' : datetile.strptime(data.get('iv_pd_date'), '%Y-%m-%d').date(),
                'ms_data' : datetile.strptime(data.get('iv_ms_date'), '%Y-%m-%d').date(),
                'created_by' : user,
                'ip' : ip_address,
            }
        )

        return cls.object.get_or_create(
            sample = sample,
            defaults={
                'iv_device_classification' : data.get('iv_device_classification'),
                'iv_device_structure' : data.get('iv_device_structure'),
                'iv_total_thickness' : flat(data.get('total_thickness', [])),
                'iv_vbias' : [float(w) if w is not None else None for w in data.get('iv_vbias', [])],
                'iv_idata' : [float(w) if w is not None else None for w in data.get('iv_idata', [])],
                'iv_device_structure_detail' : data.get('device_structure_detail'),
                'created_by' : user,
                'ip' : ip_address,
            }
        )[0]
        
        
class ManualFile(models.Model):
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='dvmt/manual')
    
    def __str__(self):
        return self.title
        
        
        
class DiagramBuilder(models.Model):
    """사용자가 저장한 다이어그램 구성"""
    name = models.CharField(max_length=200)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # 수정!
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} (by {self.created_by.username})"


class DiagramLayer(models.Model):
    """다이어그램의 각 레이어"""
    diagram = models.ForeignKey(DiagramBuilder, on_delete=models.CASCADE, related_name='layers')
    layer_name = models.CharField(max_length=100)
    position = models.IntegerField()
    
    class Meta:
        ordering = ['position']
    
    def __str__(self):
        return f"{self.diagram.name} - {self.layer_name}"


class DiagramMaterial(models.Model):
    """레이어 내의 재료"""
    layer = models.ForeignKey(DiagramLayer, on_delete=models.CASCADE, related_name='materials')
    
    # DB 재료인 경우
    material = models.ForeignKey('Material', on_delete=models.CASCADE, null=True, blank=True)
    homo_fitting_result = models.ForeignKey('FittingResult', on_delete=models.CASCADE, 
                                           null=True, blank=True, related_name='homo_diagrams')
    bandgap_fitting_result = models.ForeignKey('FittingResult', on_delete=models.CASCADE, 
                                               null=True, blank=True, related_name='bandgap_diagrams')
    
    # 커스텀 재료인 경우
    custom_material_name = models.CharField(max_length=100, blank=True)
    custom_homo = models.FloatField(null=True, blank=True)
    custom_lumo = models.FloatField(null=True, blank=True)
    custom_work_function = models.FloatField(null=True, blank=True)
    custom_color = models.CharField(max_length=50, default='rgba(200, 200, 200, 0.6)')  # RGBA 지원
    
    position_in_layer = models.IntegerField()
    
    class Meta:
        ordering = ['position_in_layer']
    
    def __str__(self):
        if self.material:
            return f"{self.layer.layer_name} - {self.material.mat_name}"
        return f"{self.layer.layer_name} - {self.custom_material_name}"
    
    @property
    def is_custom(self):
        return self.material is None