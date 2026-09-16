from __future__ import annotations

from typing import Any

from ortools.linear_solver import pywraplp

from app.services.forecast import forecast_service
from app.services.grid_engine import engine


def optimize_schedule(
    horizon_minutes: int = 60,
    allow_v2g: bool = True,
    allow_p2p: bool = True,
    max_export_kw: float = 80.0,
) -> dict[str, Any]:
    """LP: cover forecast load with solar, BESS, optional V2G, P2P, and grid import."""
    forecast = forecast_service.predict(horizon_minutes)
    snap = engine.state
    soc0 = float(snap["assets"]["battery_soc_pct"]) / 100.0
    energy_kwh_cap = 850.0
    dt_h = 1.0 / 60.0

    solver = pywraplp.Solver.CreateSolver("GLOP")
    if solver is None:
        raise RuntimeError("OR-Tools GLOP solver unavailable")

    slots = forecast["points"]
    n = len(slots)
    grid = [solver.NumVar(0.0, 400.0, f"grid_{t}") for t in range(n)]
    bess_ch = [solver.NumVar(0.0, 70.0, f"ch_{t}") for t in range(n)]
    bess_dis = [solver.NumVar(0.0, 70.0, f"dis_{t}") for t in range(n)]
    v2g = [solver.NumVar(0.0, 90.0 if allow_v2g else 0.0, f"v2g_{t}") for t in range(n)]
    p2p = [solver.NumVar(0.0, max_export_kw if allow_p2p else 0.0, f"p2p_{t}") for t in range(n)]
    unserved = [solver.NumVar(0.0, 500.0, f"uns_{t}") for t in range(n)]
    soc = [solver.NumVar(0.15, 0.98, f"soc_{t}") for t in range(n)]

    import_price = 0.22
    v2g_price = 0.18
    unserved_price = 12.0
    cycle_price = 0.04

    obj = solver.Objective()
    for t in range(n):
        obj.SetCoefficient(grid[t], import_price * dt_h)
        obj.SetCoefficient(v2g[t], v2g_price * dt_h)
        obj.SetCoefficient(unserved[t], unserved_price * dt_h)
        obj.SetCoefficient(bess_ch[t], cycle_price * dt_h)
        obj.SetCoefficient(bess_dis[t], cycle_price * dt_h)
        obj.SetCoefficient(p2p[t], -0.03 * dt_h)
    obj.SetMinimization()

    for t, point in enumerate(slots):
        solar = point["solar_kw"]
        load = point["load_kw"]
        # power balance (kW)
        solver.Add(
            solar + bess_dis[t] + v2g[t] + grid[t] + unserved[t]
            == load + bess_ch[t] + p2p[t]
        )
        if t == 0:
            solver.Add(
                soc[t]
                == soc0
                + (bess_ch[t] * 0.95 - bess_dis[t] / 0.95) * dt_h / energy_kwh_cap
            )
        else:
            solver.Add(
                soc[t]
                == soc[t - 1]
                + (bess_ch[t] * 0.95 - bess_dis[t] / 0.95) * dt_h / energy_kwh_cap
            )

    status = solver.Solve()
    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise RuntimeError("Energy schedule infeasible")

    out_slots = []
    uns = 0.0
    for t, point in enumerate(slots):
        uns += unserved[t].solution_value() * dt_h
        out_slots.append(
            {
                "minute": point["minute"],
                "solar_kw": point["solar_kw"],
                "load_kw": point["load_kw"],
                "battery_kw": round(
                    bess_dis[t].solution_value() - bess_ch[t].solution_value(), 2
                ),
                "v2g_kw": round(v2g[t].solution_value(), 2),
                "grid_import_kw": round(grid[t].solution_value(), 2),
                "p2p_kw": round(p2p[t].solution_value(), 2),
                "soc_pct": round(soc[t].solution_value() * 100.0, 1),
            }
        )

    notes = [
        "Objective minimizes import + V2G wear + unserved energy.",
        "BESS efficiency modeled at 95% charge / discharge.",
    ]
    if allow_v2g:
        notes.append("V2G enabled up to 90 kW fleet discharge.")
    if allow_p2p:
        notes.append("P2P export credited in the objective.")
    if engine.crisis:
        notes.append(f"Twin is in crisis mode: {engine.crisis}.")

    return {
        "objective_cost": round(obj.Value(), 4),
        "unserved_kwh": round(uns, 4),
        "slots": out_slots,
        "notes": notes,
    }
