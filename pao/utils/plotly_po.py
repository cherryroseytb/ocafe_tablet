COLORCODE = [
    "#000000",
    "#FF0000",
    ...
    ]

class IVLPlotlyProcessor:
    def __init__(self) -> None:
        self.vjl_layout = {
            "title": {...},
            "font": {...},
            "xaxis": {...},
            "yaxis": {...},
            "yaxis2": {...},
            "showlegend": True,
            "legend": {...}
        },
        #self.cj_layout, self.el_layout
        
    @property
    def index(self):
        return self.__index
        
    @index.setter
    def index(self, index):
        self.__index = index % len(COLORCODE)
        
    @property
    def ivl_processed(self):
        return self.__lt_processed
        
    @ivl_processed.setter
    def ivl_processed(self, ivl_processed):
        self.__ivl_processed = ivl_processed["lt"]
        self.ivl_id = ivl_processed["ivl_id"]
        
    def get_ivl(self):
		vjl = self.__ivl_processed["vjl"]
		vjl = vjl[vjl["J(mA/cm2"] > 0]
		
        data = [
            {
                "x": vjl["V(volt)]"].to_list(),
                "y": vjl["J(mA/cm2)]"].to_list(),
                "name": f"{self.ivl_id}_J",
                "mode": "lines"
                "type": "scatter",
                "line": {"color": COLORCODE[self.__index]},
            },
            # 그외 데이터
            ]
        return data


class LTPlotlyProcessor:
    def __init__(self) -> None:
        self.lt_layout = {
            "title": {...},
            "font": {...},
            "xaxis": {...},
            "yaxis": {...},
            "showlegend": True,
            "legend": {...}
        }
        
    @property
    def index(self):
        return self.__index
        
    @index.setter
    def index(self, index):
        self.__index = index % len(COLORCODE)
        
    @property
    def lt_processed(self):
        return self.__lt_processed
        
    @lt_processed.setter
    def lt_processed(self, lt_processed):
        self.__lt_processed = lt_processed["lt"]
        self.lt_id = lt_processed["lt_id"]
        
    def get_lt(self):
        data = [
            {
                "x": self.__lt_processed["Hour(h)]"].to_list(),
                "y": self.__lt_processed["Intensity(%)]"].to_list(),
                "name": f"{self.lt_id}",
                "type": "scatter",
                "line": {"color": COLORCODE[self.__index]},
            }]
        return data