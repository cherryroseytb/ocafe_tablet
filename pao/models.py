from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class AccessLog(models.Model):
    created_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    ip = models.GenericIPAddressField()
    
    class Meta:
        abstract = True

class DOE(AccessLog, models.Model):
    STRUCTURE_FIELDS = [
        "Layer",
        "Order",
        "Thickness",
        "Material",
        "Ratio",
        "EV_Chamber",
        "Cell_No",
    ]
    
    class Meta:
        ordering = ["-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "product_type",
                    "model",
                    "exp_date",
                    "color",
                    "runsheet_lot",
                    "gls_id",
                ],
                name="doe_uniq",
            ),
        ]
    
    class ColorChoices(models.TextChoices):
        R = "R", "RED"
        G = "G", "GREEN"
        B = "B", "BLUE"
        W = "W", "WHITE"
    
    class ProductTypeChoices(models.TextChoices):
        PO = "PO", "PO"
        TV = "TV", "TV"
        
    product_type = models.CharField(choices=ProductTypeChoices.choices, max_length=5, default=ProductTypeChoices.PO)
    model = models.TextField(verbose_name="제품모델")
    sequence = models.TextField(blank=True, null=True, verbose_name="실험 차수")
    
    runsheet_lot = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(100),])
    gls_id = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(11)])
    color = models.CharField(choices=ColorChoices.choices, max_length=1)
    condition = models.TextField()
    remark = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.model}_{self.exp_date}_{self.color}_{self.runsheet_lot}_{self.gls_id}"

    @property
    def structure_data(self):
        layers = self.layer.all()
        to_array = lambda x: ([str(i) for i in x] if isinstance(x, models.query.QuerySet) else [str(x)])
        
        structure_map = {
            "Layer": lambda x: [x.name],
            "Order": lambda x: [x.order],
            "Thickness": lambda x: [x.thickness],
            "Material": lambda x: to_array(x.material.values_list("name", flat=True)),
            "Ratio": lambda x: to_array(x.lmp_layer.values_list("ratio", flat=True)),
            "EV_Chamber": lambda x: to_array(x.processinfo.values_list("ev_chamber", flat=True)),
            "Cell_No": lambda x: to_array(x.processinfo.values_list("cell_no", flat=True))
        }
        
        enabled_fields = [field for field in self.STRUCTURE_FIELDS if field in structure_map]
        
        rows = [{field: structure_map[field](layer) for field in enabled_fields} for layer in layers.order_by("order")]
        
        return {"headers": self.STRUCTURE_FIELDS, "rows": rows}
        
    @property
    def structure_json_array(self):
        lmp_query = (
            LayerMaterialProcess.objects.filter(layer__doe=self)
            .select_related("layer", "material", "process_info")
            .all()
        )
        
        structure_dict = [
            {
                "Layer": item.layer.name,
                "Order": item.layer.order,
                "Thickness": item.layer.thickness,
                "Material": item.material.name,
                "Ratio": item.ratio,
                "EV_Chamber": item.process_info.ev_chamber,
                "Cell_No": item.process_info.cell_no,
            }
            for item in lmp_query
        ]
        
        return structure_dict
        
        
class Layer(models.Model):
    name = models.CharField(max_length=100)
    doe = models.ForeignKey("DOE", on_delete=models.CASCADE, related_name="layer")
    order = models.PositiveSmallIntegerField()
    thickness = models.PositiveIntegerField()
    material = models.ManyToManyField("Material", through="LayerMaterialProcess")
    processinfo = models.ManyToManyField("ProcessInfo", through="LayerMaterialProcess")
    
    class Meta:
        ordering = ["doe", "order"]
        constraints = [models.UniqueConstraint(fields=["doe", "order"], name="unique_layer_name_per_doe")]
        
    def __str__(self):
        return f"{self.doe}_{self.name}"
    
        
class Material(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    def __str__(self):
        return f"{self.name}"
    
        
class ProcessInfo(models.Model):
    cell_no = models.PositiveSmallIntegerField()
    ev_chamber = models.CharField(max_length=100)
    
    class Meta:
        ordering = ["ev_chamber"]
        constraints = [models.UniqueConstraint(fields=["ev_chamber", "cell_no"], name="unique_ev_chamber_and_cell_no")]
        
    def __str__(self):
        return f"Chamber:{self.ev_chamber}, Cell:{self.cell_no}"
        
        
class LayerMaterialProcess(models.Model):
    layer = models.ForeignKey("Layer", on_delete=models.CASCADE, related_name="lmp_layer")
    material = models.ForeignKey("Material", on_delete=models.CASCADE, related_name="lmp_material")
    process_info = models.ForeignKey("ProcessInfo", on_delete=models.CASCADE, related_name="lmp_pinfo")
    ratio = models.FloatField()
    
    class Meta:
        ordering = ["layer", "material"]
        constraints = [models.UniqueConstraint(
            fields=["layer", "material", "process_info", "ratio"], 
            name="unique_layer_material_processinfo")
        ]
    
    def __str__(self):
        return f"{self.layer}_{self.material}_{self.ratio:.2f}"
        

	    
#수정 버전
class IVL(AccessLog, models.Model):
    """
	expt = [{"x": 0.2, "y": 0.3, "cct": 9000, "n(QE)": 40, "order": 1.0, "V(volt)": 3, "CE(cd/A)": 100, "LE(lm/W)": 20, "filename": "V190101-2.csv (0)", "J(mA/cm2)": 0.25, "Current(mA)": 0.01, "L(cd/m2(nit))": 300}, {"order": 2.0, ...}, ...,]
	expt_spec = [{"0": {"380.0": 0.0, "384.0": 0.1, "388.0": 0.1, ..., "780.0": 0.1}}, {"1": {"380.0": 0.0, ...}}, ...]
    """
    class Meta:
        ordering = ["-pk"]
        indexes = [models.Index(fields=["doe", "ivl_id"])]
        constraints = [models.UniqueConstraint(fields=["doe", "filename"], name="ivl_uniq")]

    doe = models.ForeignKey(DOE, on_delete=models.CASCADE)
    ivl_id = models.CharField(max_length=30, blank=True)
    filename = models.CharField(max_length=100, blank=True)
    expt = models.JSONField(blank=False, null=False)
    expt_spec = models.JSONField(blank=False, null=False)
    is_J10 = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.ivl_id}"

    @property
    def check_is_J10(self) -> bool:
        """
        J10 판정:
        - 데이터가 1개만 있고 J≈10 → True
        - 그 외 (Sweep 포함) → False
        """
        expt = self.expt
        if len(expt) == 1:
            j = float(expt[0].get("J(mA/cm2)", -999))
            if abs(j - 10) < 0.5:  # 허용 오차
                return True
        return False

        
class LT(AccessLog, models.Model):
    """
    expt = [{"vdelta":0.0, "tempset":40.0, "J(mA/cm2)": 40.0025, "[Channel]": 3.0, "[Hour(h)]": 0.1, "datafolder": "D:\\#pluto12\\OC3\\85차", "[Intensity(%)]": 100.0, ...},{},{},...,{}]
    expt_spec = [{"0": {"380.0": 0.0001, "384": 0.0002,...,"780.0": 0.0001}, "1" : {...}, ...}]
    
    테이블에 표시할 내용
    sample 위치 : #pluto12, 채널3
    평가조건 : 40J / 40도
    T95 수명(hr) : 
        W : 200
        R : 300
        G : 400(예측)
        B : 200
        B peak : 150
    delta v (Green이 T95가 되는 시간의 vdelta 값)
        
    그래프로 표시할 내용(시간에 따른 값 변화)
    time vs intensity(W)
    time vs intensity(spectrum이 R,G,B 컬러필터 통화한 값의 integral%)
    time vs intensity(spectrum의 blue 영역 peak 최대값의 %)
    time vs vdelta
    
    """
    class Meta:
        ordering = ["-pk"]
        indexes = [models.Index(fields=["doe"])]
        
    doe = models.ForeignKey(DOE, on_delete=models.CASCADE)
    lt_id = models.CharField(max_length=30, blank=True)
    filename = models.CharField(max_length=100, blank=True)
    expt = models.JSONField(blank=False, null=False)
    expt_spec = models.JSONField(blank=False, null=False)
    
    def __str__(self):
        return f"{self.lt_id}"
        
        
        
class CV(AccessLog, models.Model):
    class Meta:
        ordering = ["-pk"]
        indexes = [models.Index(fields=["doe"])]
        
    doe = models.ForeignKey(DOE, on_delete=models.CASCADE)
    cv_id = models.CharField(max_length=30, blank=True)
    filename = models.CharField(max_length=100, blank=True)
    expt = models.JSONField(blank=False, null=False)
    
    def __str__(self):
        return f"{self.cv_id}"
        
        
class IV(AccessLog, models.Model):
    class Meta:
        ordering = ["-pk"]
        indexes = [models.Index(fields=["doe"])]
        
    doe = models.ForeignKey(DOE, on_delete=models.CASCADE)
    iv_id = models.CharField(max_length=30, blank=True)
    filename = models.CharField(max_length=100, blank=True)
    expt = models.JSONField(blank=False, null=False)
    
    def __str__(self):
        return f"{self.iv_id}"
        
        
class Angle(AccessLog, models.Model):
    """
    expt = [{"x": 0.2, "y": 0.3, "cct": 16000, "n(QE)": 40.1, "order": 1.0, "V(volt)": 10.2, "CE(cd/A)": 10.3, "LE(lm/W)": 10.2, "filename": "V150144-1.csv (0)", "J(mA/cm2)": 9.99, "Current(mA)": 0.399, L(cd/m2(nit))": 10000.2}, {...,"filename": "V150144-1.csv (15)",...}, {...,"filename": "V150144-1.csv (30)",...}, {...,"filename": "V150144-1.csv (45)",...}, {...,"filename": "V150144-1.csv (60)",...}]
    """
    class Meta:
        ordering = ["-pk"]
        indexes = [models.Index(fields=["doe"])]
        
    doe = models.ForeignKey(DOE, on_delete=models.CASCADE)
    angle_id = models.CharField(max_length=30, blank=True)
    filename = models.CharField(max_length=100, blank=True)
    expt = models.JSONField(blank=False, null=False)
    expt_spec = models.JSONField(blank=False, null=False)
    
    def __str__(self):
        return f"{self.angle_id}"
            
# class Tristimulus(models.Model):
#     label = models.CharField(max_length=50, unique=True, default="CIE1931")
#     xyz_data = models.JSONField()  
#     # 예: {"380.0": {"x": 0.001, "y": 0.0001, "z": 0.006}, "381.0": {...}, ...}
    
class TVColorFilter(AccessLog, models.Model):
    label = models.CharField(max_length=50)  # ✨ unique=True 제거
    rgb_data = models.JSONField()  
    
    def __str__(self):
        return f"{self.label}"
        
    class Meta: 
        ordering = ["-pk"]
        indexes = [
            models.Index(fields=["label"]),
        ]
        constraints = [
            # ✨ 변경: label + created_user 조합으로 unique
            models.UniqueConstraint(
                fields=["label", "created_user"], 
                name="unique_tv_colorfilter_user"
            )
        ]
	
    
class TVLineFactor(AccessLog, models.Model):
    label = models.CharField(max_length=50)  # ✨ unique=True 제거
    rf = models.FloatField()
    gf = models.FloatField()
    bf = models.FloatField()
    wf = models.FloatField()
    rp = models.FloatField()
    gp = models.FloatField()
    bp = models.FloatField()
    wp = models.FloatField()
    rx = models.FloatField()
    gx = models.FloatField()
    bx = models.FloatField()
    wx = models.FloatField()
    ry = models.FloatField()
    gy = models.FloatField()
    by = models.FloatField()
    wy = models.FloatField()
        
    class Meta: 
        ordering = ["-pk"]
        indexes = [
            models.Index(fields=["label"]),
        ]
        constraints = [
            # ✨ 변경: label + created_user 조합으로 unique
            models.UniqueConstraint(
                fields=["label", "created_user"], 
                name="unique_tv_linefactor_user"
            )
        ]

    @property
    def as_matrix(self):
        """numpy 배열로 변환 (channels × attributes)"""
        import numpy as np
        return {
            "R": {"x": self.rx, "y": self.ry, "eff": self.rf},
            "G": {"x": self.gx, "y": self.gy, "eff": self.gf},
            "B": {"x": self.bx, "y": self.by, "eff": self.bf},
            "W": {"x": self.wx, "y": self.wy, "eff": self.wf},
        }

    def __str__(self):
        return f"{self.label}"
	
from taggit.managers import TaggableManager
	
class AnalysisProfile(LifecycleModelMixin, AccessLog, models.Model):
	title = model.CharField(max_length=100)
	summary = model.CharField(max_length=255, blank=True)
	description = models.TextField(blank=True)
	favorite = models.BooleanField(blank=True, default=False)
	shared_user = models.ManyToManyField(
		settings.AUTH_USER_MODEL,
		through="AnalysisProfilePermission",
		through_fields=("profile", "user"),
		related_name = "shared_analysis_profiles",
		blank=True
	)
	
	class ProductTypeChoices(models.TextChoices):
		PO = "PO", "PO"
        TV = "TV", "TV"
        IT = "IT", "IT"
        
    product_type = models.CharField(
	choices=ProductTypeChoices.choices, max_length=5, default=ProductTypeChoices.PO)
	
	tag = TaggableManager(blank=True)
	doe = models.ManyToManyField(
		"DOE",
		through="ProfileDOE",
		through_fields="analysis_profile","doe",
		related_name="doe",
		blank=True
	)
	
	class Meta:
		ordering = ["-pk"]
		indexes = [models.Index(fields=["title"])]
		
	def __str__(self):
		return f"{self.pk}_{self.title}"
		
	@hook(BEFORE_SAVE, when="summary")
	def before_summary_processed(self):
		self.hashtags: list[str] = re.findall(r"#(\w+)", self.summary)
		cleaned_summary: str = re.sub(r"#\w+", "", self.summary)
		self.summary = cleaned_summary.strip()
		
	@hook(AFTER_SAVE, when="summary")
	def on_summary_processed(self):
		self.tags.set(self.hashtags)
		
class ProfileDOE(models.Model):
	doe = models.ForeignKey("DOE", on_delete=models.CASCADE, related_name="profile_links")
	analysis_profile = models.ForeignKey(
		"AnalysisProfile", on_delete=models.CASCADE, related_name="doe_links"
	)
	
	class Meta:
		indexes = [models.Index(fields=["analysis_profile", "doe"])]
		constraints=[
			models.UniqueConstraint(fields=["analysis_profile", "doe"], name="unique_profile_doe")
		]
		
class AnalysisProfilePermission(models.Model):
	PERMISSION_CHOICES = (
		("view", "View"),
		("edit", "Edit"),
	)
	
	profile = models.ForeignKey("AnalysisProfile", on_delete=models.CASCADE, related_name="permissions")
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="analysis_permissions"
	)
	permission_level = models.CharField(max_length=5, choices=PERMISSION_CHOICES, default="view")
	shared_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="shared_permissions"
	)
	shared_at = models.DateTimeField(auto_now_add=True)
	
	class Meta:
		constraints = [
			models.UniqueConstraint(
			  	fields=["profile", "user"],
			  	name="unique_user_permission"
			),	
		]
		indexes = [
			models.Index(fields=["profile", "user"]),            	
			models.Index(fields=["profile", "permission_level"]),	
		]
		
@receiver(post_save, sender=AnalysisProfile)
def _set_owner_permission(sender, instance, created, **kwargs):
	if created:
		AnalysisProfilePermission.objects.update_or_create(
			profile=instance,
			user=instance.created_user,
			defaults={"permission_level": "edit", "shared_by": instance.created_user})
			
			

def default_layout():
	DEFAULT_LAYOUT = {
		"vjl-chart": {
			"title": {...},
	        "font": {...},
	        "xaxis": {...},
	        "yaxis": {...},
	        "yaxis2": {...},
	        "showlegend": True,
	        "legend": {...}
		}, #그외 여러가지
		#대충 작성한거임. 실제는 다름
		"angular-spectrum-chart": {
            "title": {"text": "Angular Spectrum"},
            "xaxis": {"title": "Wavelength (nm)"},
            "yaxis": {"title": "Intensity"},
            "showlegend": True
        },
        "delta-uv-angle-chart": {
            "title": {"text": "Δu'v' vs Angle"},
            "xaxis": {"title": "Angle (°)"},
            "yaxis": {"title": "Δu'v'"},
            "showlegend": True
        }
	}
	return DEFAULT_LAYOUT
	
	
class ProfilePOAdditions(AccessLog, models.Model):
	analysis_profile = models.OneToOneField(
		AnalysisProfile,
		on_delete=models.CASCADE,
		related_name="po_additions",
		db_index=True,
	)
	
	productspec = models.ForeignKey(
		"ProductSpec",
		on_delete=models.CASCADE
		null=True,
		blan=True,
		related_name="product_spec_additions"
	)
	
	# Plotly 레이아웃 JSON
	layout = models.JSONField(defaults=default_layout, blanke=True)
	vjl_table = models.JSONField(default=dict, blank=True)
	
	modified_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE
		null=True,
		blank=True,
		related_name="modified_po_additions",
		help_text="가장 최근에 이 프로필 추가정보를 저장한 사용자",
	)
	
	class Meta:
		verbose_name = "Profile PO Additions"
		verbose_name_plural = "Profile PO Additions"
		
	def __str__(self):
		return f"POAdditions<profile={self.analysis_profile_id}>"
		
		
class ProfileTVAdditions(AccessLog, models.Model):
    """TV 분석 프로필 추가 정보
    
    AnalysisProfile과 1:1 관계로, TV 분석 시 사용하는 필터 설정을 저장
    - ColorFilter: RGB 색상 필터
    - LineFactor: 라인 보정 계수
    - AgingTime: LT 분석 시간 (분)
    - TableState: 테이블 UI 상태 (숨김, 순서, 선택 등)
    """
    
    analysis_profile = models.OneToOneField(
        "AnalysisProfile",
        on_delete=models.CASCADE,
        related_name="tv_additions",
        db_index=True,
        help_text="연결된 분석 프로필"
    )
    
    color_filter = models.ForeignKey(
        "TVColorFilter",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tv_profile_additions",
        help_text="선택된 Color Filter"
    )
    
    line_factor = models.ForeignKey(
        "TVLineFactor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tv_profile_additions",
        help_text="선택된 Line Factor"
    )
    
    aging_time = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
        help_text="LT 분석 시간 (분), 기본값 30분"
    )
    
    # ✨ 테이블 UI 상태 (개별 필드)
    hidden_columns = models.JSONField(
        default=list,
        blank=True,
        help_text="숨김 처리된 컬럼 DOE ID 목록"
    )
    
    hidden_rows = models.JSONField(
        default=list,
        blank=True,
        help_text="숨김 처리된 Row fieldName 목록"
    )
    
    column_order = models.JSONField(
        default=list,
        blank=True,
        help_text="컬럼 순서 (DOE ID 목록)"
    )
    
    reference_columns = models.JSONField(
        default=list,
        blank=True,
        help_text="Reference로 지정된 컬럼 목록"
    )
    
    selected_columns = models.JSONField(
        default=list,
        blank=True,
        help_text="선택된 컬럼 목록 (파란색)"
    )
    
    modified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="modified_tv_additions",
        help_text="가장 최근에 이 프로필 추가정보를 저장한 사용자"
    )
    
    class Meta:
        verbose_name = "Profile TV Additions"
        indexes = [
            models.Index(fields=["analysis_profile"]),
        ]
    
    def __str__(self):
        return f"TVAdditions<profile={self.analysis_profile_id}>"
        
class TVDeltaVBaseline(AccessLog, models.Model):
    """Delta V 차트 기준선 데이터"""
    label = models.CharField(max_length=50)  # ✨ unique=True 제거
    baseline_data = models.JSONField()  
    
    class Meta:
        ordering = ["-pk"]
        indexes = [
            models.Index(fields=["label"]),
        ]
        constraints = [
            # ✨ 변경: label + created_user 조합으로 unique
            models.UniqueConstraint(
                fields=["label", "created_user"], 
                name="unique_tv_deltabaseline_user"
            )
        ]
        
    def __str__(self):
        return f"{self.label} ({len(self.baseline_data)} points)"