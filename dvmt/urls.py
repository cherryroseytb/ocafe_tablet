from django.urls import path
from dvmt import views


app_name = "dvmt"

urlpatterns = [
    path('meas_list/', views.meas_list_view, name='meas_list'),
    path('meas_list/<str:mat_name>/', views.meas_list_view, name='meas_list_by_material'),  # 특정 mat_name에 대한 리스트 추가
    path('meas_detail/<str:mat_name>/', views.meas_detail_view, name='meas_detail'),  # sample_id → mat_name 변경
    path('meas_compare/', views.meas_compare, name='meas_compare'),
    path('meas_manual/', views.meas_manual_view, name='meas_manual'),
    path('diagram-builder/', views.diagram_builder_view, name='diagram_builder'),
    path('api/search-materials/', views.search_materials_api, name='search_materials_api'),
    path('api/save-diagram/', views.save_diagram_api, name='save_diagram_api'),
    path('api/load-diagram/<int:diagram_id>/', views.load_diagram_api, name='load_diagram_api'),
    path('api/list-diagrams/', views.list_diagrams_api, name='list_diagrams_api'),
    path('api/update-diagram/<int:diagram_id>/', views.update_diagram_api, name='update_diagram_api'),
    path('api/delete-diagram/<int:diagram_id>/', views.delete_diagram_api, name='delete_diagram_api'),
]