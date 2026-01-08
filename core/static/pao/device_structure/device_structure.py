from django_components import Component
from django_components import register


@register("doe_structure")
class DOEStructure(Component):
    # TODO: components upgrade 후 API 처럼 동작하도록 변경, 기존 뷰 삭제
    template_file = "doe_structure.html"
    js_file = "doe_structure.js"
    css_file = "doe_structure.css"

    def get_context_data(self, doe):
        context = {}
        context["doe"] = doe

        return context
