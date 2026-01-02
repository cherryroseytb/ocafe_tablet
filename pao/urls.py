from django.urls import path
from pao import tab_view, views, upload_views, tv_views, api

app_name = "pao"

urlpatterns = [
    path(route="device_detail/<int:pk>/", view=views.device_detail, name="device_detail"),
    #List DOE page
    path(route="device/list", view=tab_view.device_list, name="device_list"),
    path(route="device/get", view=tab_view.get_device, name="get_device"),
    path(route="device/delete", view=tab_view.delete_device, name="delete_device"),
    # TV
    path(route="device/tv/compare/<int:profile_id>/", view=tv_views.compare_tv, name="compare_tv"),
    path(route="device/tv/get_ivl_table/", view=tv_views.tv_get_ivl_table, name="tv_get_ivl_table"),
    path(route="device/tv/get_ivl_color_table/", view=tv_views.tv_get_ivl_color_table, name="tv_get_ivl_color_table"),
    path(route="device/tv/get_angle_table/", view=tv_views.tv_get_angle_table, name="tv_get_angle_table"),
    path(route="device/tv/get_lt_table/", view=tv_views.tv_get_lt_table, name="tv_get_lt_table"),
    path(route="device/tv/colorfilter_edit/", view=tv_views.tv_colorfilter_edit, name="tv_colorfilter_edit"),
    path(route="device/tv/linefactor_edit/", view=tv_views.tv_linefactor_edit, name="tv_linefactor_edit"),
    path('device/tv/colorfilter/list/', tv_views.tv_colorfilter_list, name='tv_color_filter_list'),
	path('device/tv/linefactor/list/', tv_views.tv_linefactor_list, name='tv_line_factor_list'),
    # 동적 그래프 관련
    path(route="device/tv/graph_options/", view=tv_views.tv_get_graph_options, name="tv_get_graph_options"),
    path(route="device/tv/graph_data/", view=tv_views.tv_get_dynamic_graph_data, name="tv_get_dynamic_graph_data"),
    path(route="device/tv/gamut_analysis/", view=tv_views.tv_gamut_analysis, name="tv_gamut_analysis"),
    path(route="device/tv/chart_data/", view=tv_views.tv_get_chart_data, name="tv_get_chart_data"),

    path(route="device/tv/deltav-baseline/edit/", view=tv_views.tv_deltav_baseline_edit, name="tv_deltav_baseline_edit"),
    path(route="device/tv/deltav-baselines/", view=tv_views.tv_get_deltav_baselines, name="tv_get_deltav_baselines"),
    path(route="device/tv/deltav-baseline-data/", view=tv_views.tv_get_deltav_baseline_data, name="tv_get_deltav_baseline_data"),
    path(route="device/tv/doe_angle_charts/", view=tv_views.tv_doe_angle_charts, name="tv_doe_angle_charts"),
    
    path(route="device/pao/guide/", view=tv_views.pao_guide, name="pao_guide"),
    
]	
