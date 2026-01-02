from django.contrib import admin
from .models import (
    Material, Sample, FittingResult, AC3Meas, EllipsometerMeas, PLMeas,
    PLQYMeas, UVVISMeas, LTPLMeas, TRPLMeas, CVMeas, IVMeas, ManualFile
)

# Material 모델 Admin
@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('mat_name', 'mass_code', 'mat_type', 'maker')
    search_fields = ('mat_name', 'mass_code')
    ordering = ('mat_name',)


# Sample 모델 Admin
@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_mat_name', 'pd_equip', 'ms_equip')
    search_fields = ('id', 'material__mat_name', 'pd_equip', 'ms_equip')
    list_filter = ('material__mat_name', 'pd_equip', 'ms_equip')
    ordering = ('material__mat_name',)

    def get_mat_name(self, obj):
        return obj.material.mat_name
    get_mat_name.short_description = 'mat_name'


# 공통 기반 Admin (측정모델 전용 - ms_equip 제외)
class BaseMeasAdmin(admin.ModelAdmin):
    list_display = ('get_mat_name', 'get_sample_id', 'get_pd_equip')
    search_fields = ('sample__material__mat_name', 'sample__id', 'sample__pd_equip')
    list_filter = ('sample__material__mat_name', 'sample__pd_equip')
    ordering = ('sample__material__mat_name',)

    def get_mat_name(self, obj):
        return obj.sample.material.mat_name
    get_mat_name.short_description = 'mat_name'

    def get_sample_id(self, obj):
        return obj.sample.id
    get_sample_id.short_description = 'sample_id'

    def get_pd_equip(self, obj):
        return obj.sample.pd_equip
    get_pd_equip.short_description = 'pd_equip'


# FittingResult는 ms_equip 필요하므로 기존 방식 유지
@admin.register(FittingResult)
class FittingResultAdmin(admin.ModelAdmin):
    list_display = ('get_mat_name', 'get_sample_id', 'get_pd_equip', 'get_ms_equip')
    search_fields = ('sample__material__mat_name', 'sample__id', 'sample__pd_equip', 'sample__ms_equip')
    list_filter = ('sample__material__mat_name', 'sample__pd_equip', 'sample__ms_equip')
    ordering = ('sample__material__mat_name',)

    def get_mat_name(self, obj):
        return obj.sample.material.mat_name
    get_mat_name.short_description = 'mat_name'

    def get_sample_id(self, obj):
        return obj.sample.id
    get_sample_id.short_description = 'sample_id'

    def get_pd_equip(self, obj):
        return obj.sample.pd_equip
    get_pd_equip.short_description = 'pd_equip'

    def get_ms_equip(self, obj):
        return obj.sample.ms_equip
    get_ms_equip.short_description = 'ms_equip'


# 측정 관련 모델 등록
@admin.register(AC3Meas)
class AC3MeasAdmin(BaseMeasAdmin): pass

@admin.register(EllipsometerMeas)
class EllipsometerMeasAdmin(BaseMeasAdmin): pass

@admin.register(PLMeas)
class PLMeasAdmin(BaseMeasAdmin): pass

@admin.register(PLQYMeas)
class PLQYMeasAdmin(BaseMeasAdmin): pass

@admin.register(UVVISMeas)
class UVVISMeasAdmin(BaseMeasAdmin): pass

@admin.register(LTPLMeas)
class LTPLMeasAdmin(BaseMeasAdmin): pass

@admin.register(TRPLMeas)
class TRPLMeasAdmin(BaseMeasAdmin): pass

@admin.register(CVMeas)
class CVMeasAdmin(BaseMeasAdmin): pass

@admin.register(IVMeas)
class IVMeasAdmin(BaseMeasAdmin): pass


# ManualFile 단순 Admin
@admin.register(ManualFile)
class ManualFileAdmin(admin.ModelAdmin):
    list_display = ('title',)
    search_fields = ('title',)