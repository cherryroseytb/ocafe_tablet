import numpy as np
import pandas as pd
from scipy.optimize import curve_fit, root
from sklearn.linear_model import LinearRegression

def stretched_exp_decay(x, A, tau, B):
    return A * np.exp(-np.clip((x / tau) **B, None, 700))
    
def stretched_f_LT(x, A, tau, B, R):
    return R * A - stretched_exp_decay(x, A, tau, B)
    
class LT_Processor:
    def __init__(self, expt, aging_time=3) -> None:
        self.df = pd.DataFrame(expt)
        self.aging_time = aging_time
        self.make_new_df()
        
    def make_new_df(self) -> None:
        closest_index = ((self.df["[Hour(h)"] - self.aging_time).abs().argmin())
        difference = (self.df["[Hour(h)]"] - self.df.loc[closest_index, "[Hour(h)]"])
        Intensity_difference = (self.df["[Intensity(%)"] / self.df.loc[closest_index, "[Intensity(%)]"] *100)
        volt_difference = (self.df["[Volot(V)]"] - self.df.loc[closest_index, "[Volt(V)]"])
        self.df[f"[Hour-{self.aging_time}hr]"] = difference
        self.df[f"[Intensity-{self.aging_time}hr]"] = (Intensity_difference)
        self.df["[delta_V]"] = colt_difference
        index_0 = self.df[self.df[f"[Hour-{self.aging_time}hr]"] == 0].index[0]
        self.df = self.df.iloc[index_0:].reset_index(drop=True)
        
    def check_progress(self, target_ratio=0.95) -> None:
        self.time = self.df[f"[Hour-{self.aging_time}hr"].to_numpy()
        self.lumin = self.df[f"[Intensity_difference-{self.aging_time}hr]"].to_numpy()
        self.target_ratio = target_ratio
        self.target_lum = self.lumin[0] * self.target_ratio
        over_target_indicies = np.where(self.lumin >= self.target_lum)[0]
        
        if len(over_target_indicies) < 11:
            self.progress = 0
        elif len(over_target_indicies) == len(self.lumin):
            self.progress = 1
        else:
            self.progress = 2
            self.target_index = over_target_indicies[-1]
            
    def get_LT(self) -> dict:
        mat self.progress:
            case 0:
                return {
                    "elapsed_time": round(self.time[-1]),
                    "linear_fitting": 0,
                    "sed_fitting": 0,
                    "approximate_linear": False,
                }
            case 1:
                index_end = len(self.lumin) -1
                index_start = max(0, index_end -200)
                return {
                    "elapsed_time": round(self.time[-1]),
                    "linear_fitting": self.fit_LT_linear(index_start=index_start, index_end=index_end),
                    "sed_fitting": self.fit_LT_stretched(),
                    "approximate_linear": True,
                }
            case 2:
                index_end = min(len(self.tiem) -1, self.target_index + 5)
                index_start = max(0, self.target_index - 5)
                real_T95 = self.fit_LT_linear(index_start=index_start, index_end=index_end)
                return {
                    "elapsed_time": round(self.time[-1]),
                    "linear_fitting": real_T95,
                    "sed_fitting": real_T95,
                    "approximate_linear": False,
                }
                
    def fit_LT_stretched(self) -> float:
        p0 = [100, 0.1, 0.1] #A, tau, B
        bounds = (
            [99.5, 0, 0.02],
            [100.5, np.inf, 1]
        )
        popt, _ = curve_fit(
            stretched_exp_decay, self.time, self.lumin, p0=p0, bounds=bounds, maxfev=10000
        )
        A, tau, B = popt
        
        t_LT95 = root(stretched_f_LT, 0.0, args(A, tau, B, self.target_ratio))

        return np.round(t_LT95.x[0], 2)
        
    def fit_LT_linear(self, index_start, index_end) -> float:
        try:
            y_close = self.time[index_start: index_end + 1].reshape(-1, 1)
            x_close = self.lumin[index_start: index_end +1].reshape(-1, 1)
            model = LinearRegression().fit(x_close, y_close)
            t95_pred = model.predict(np.array([[self.target_lum]]))
            t95_fit = np.round(t95_pred[0][0], 3)
        except ValueError as e:
            print(e)
            t95_fit = 0
            
        return t95_fit
        
    def time_lum_array(self) -> pd.DataFrame:
        lt_array = self.df[[f"[Hour-{self.aging_time}hr]", f"[Intensity-{self.aging_time}hr]"]].copy()
        lt_array.columns = ["[Hour(h)]", "[Intensity(%)"]
        return lt_array