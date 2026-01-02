# pao/forms.py

from django import forms
from .models import TVLineFactor

class TVLineFactorForm(forms.ModelForm):
    class Meta:
        LINEFACTOR_FIELDS = [
            "rf", "gf", "bf", "wf",
            "rp", "gp", "bp", "wp",
            "rx", "gx", "bx", "wx", "ry", "gy", "by", "wy"
        ]
        model = TVLineFactor
        fields = ["label"] + LINEFACTOR_FIELDS
        
    def __init__(self, *args, **kwargs):
        # ✨ 추가: is_edit_mode와 request를 받기
        self.is_edit_mode = kwargs.pop('is_edit_mode', False)
        self.request = kwargs.pop('request', None)
        
        super().__init__(*args, **kwargs)
        self.fields["label"].label = "제품명"
        self.fields["label"].widget = forms.TextInput(  # ✨ 오타 수정: wiget → widget
            attrs={
                "class": "form-control",
                "placeholder": "라벨 (예: WBE_V19_OC3_to_E73_55U)",
            }
        )
        self.helper = FormHelper(self)
        self.helper.form_method = "post"
        self.helper.form_tag = True
        self.helper.attrs = {"novalidate": ""}
        self.helper.form_show_labels = False
        
        # ✨ 변경: 수정 모드에 따라 버튼 텍스트 변경
        submit_text = "저장" if self.is_edit_mode else "추가"
        
        self.helper.layout = Layout(
            Div(
                Div(
                    Field("label"),
                    css_class="me-auto col-auto",
                ),
                Div(
                    # ✨ 추가: 수정 모드일 때 취소 버튼 추가
                    HTML(
                        '{% if is_edit_mode %}'
                        '<a href="{% url \'pao:tv_linefactor_edit\' %}" class="btn btn-secondary me-2">취소</a>'
                        '{% endif %}'
                    ),
                    Submit("submit", submit_text, css_class="btn btn-primary"),
                    css_class="col-auto",
                ),
                css_class="d-flex flex-row gap-2 justify-content-between align-items-center mb-3",
            ),
            Div(
                PrependedText("rf", "rf"),
                PrependedText("gf", "gf"),
                PrependedText("bf", "bf"),
                PrependedText("wf", "wf"),
                css_class="d-flex flex-row gap-2 justify-content-between align-items-center",
            ),
            Div(
                PrependedText("rp", "rp"),
                PrependedText("gp", "gp"),
                PrependedText("bp", "bp"),
                PrependedText("wp", "wp"),
                css_class="d-flex flex-row gap-2 justify-content-between align-items-center",
            ),
            Div(
                PrependedText("rx", "rx"),
                PrependedText("gx", "gx"),
                PrependedText("bx", "bx"),
                PrependedText("wx", "wx"),
                css_class="d-flex flex-row gap-2 justify-content-between align-items-center",
            ),
            Div(
                PrependedText("ry", "ry"),
                PrependedText("gy", "gy"),
                PrependedText("by", "by"),
                PrependedText("wy", "wy"),
                css_class="d-flex flex-row gap-2 justify-content-between align-items-center",
            ),
        )

    def clean_label(self):
        label = self.cleaned_data["label"]
        
        # ✨ 변경: 수정 모드일 때는 중복 체크 제외
        if not self.is_edit_mode and self.request:
            # label + created_user 조합으로 체크
            if TVLineFactor.objects.filter(label=label, created_user=self.request.user).exists():
                raise forms.ValidationError(f"[{label}]은 이미 존재합니다. 삭제 후 등록하세요.")
        
        return label