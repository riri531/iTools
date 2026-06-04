using iTools.Api.Data;
using iTools.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    [AllowAnonymous]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        var totalOutils = await _context.Outils.AsNoTracking().CountAsync();
        var totalUsers = await _context.Users.AsNoTracking().CountAsync();
        var totalEmplacements = await _context.Emplacements.AsNoTracking().CountAsync();

        var emplacementStatuses = await _context.Emplacements
            .AsNoTracking()
            .Select(e => e.Status)
            .ToListAsync();

        var outils = await _context.Outils
            .AsNoTracking()
            .Select(o => new
            {
                o.Id,
                o.CodeOutillage,
                o.OTT,
                o.Status
            })
            .ToListAsync();

        var emplacementsLibres = emplacementStatuses.Count(s => NormalizeStatus(s) == "LIBRE");
        var emplacementsOccupes = emplacementStatuses.Count(s => NormalizeStatus(s) == "OCCUPE");
        var emplacementsHs = emplacementStatuses.Count(s => NormalizeStatus(s) == "HS");

        var outilsEnService = outils.Count(o => IsOutilEnService(o.Status));
        var outilsHs = outils.Count(o => NormalizeStatus(o.Status) == "HS");
        var outilsReserves = outils.Count(o => IsOutilReserve(o.Status));

        var pieLabels = new List<string>
        {
            "LIBRE",
            "OCCUPÉ",
            "HS"
        };

        var pieData = new List<int>
        {
            emplacementsLibres,
            emplacementsOccupes,
            emplacementsHs
        };

        var barSource = outils
            .OrderBy(o => o.CodeOutillage)
            .Take(10)
            .ToList();

        var barLabels = barSource
            .Select(o =>
                !string.IsNullOrWhiteSpace(o.CodeOutillage)
                    ? o.CodeOutillage
                    : !string.IsNullOrWhiteSpace(o.OTT)
                        ? o.OTT
                        : $"Outil {o.Id}"
            )
            .ToList();

        var barData = barSource
            .Select(o => IsOutilReserve(o.Status) ? 1 : 0)
            .ToList();

        if (barLabels.Count == 0)
        {
            barLabels = new List<string> { "Aucun outil" };
            barData = new List<int> { 0 };
        }

        var dto = new DashboardStatsDto
        {
            TotalOutils = totalOutils,
            TotalUsers = totalUsers,
            TotalEmplacements = totalEmplacements,

            EmplacementsLibres = emplacementsLibres,
            EmplacementsOccupes = emplacementsOccupes,
            EmplacementsHs = emplacementsHs,

            OutilsEnService = outilsEnService,
            OutilsHs = outilsHs,
            OutilsReserves = outilsReserves,

            PieLabels = pieLabels,
            PieData = pieData,

            BarLabels = barLabels,
            BarData = barData
        };

        return Ok(dto);
    }

    private static string NormalizeStatus(string? status)
    {
        var value = (status ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace("É", "E")
            .Replace("È", "E")
            .Replace("Ê", "E")
            .Replace("À", "A");

        return value switch
        {
            "LIBRE" => "LIBRE",

            "OCCUPE" => "OCCUPE",
            "OCCUPÉ" => "OCCUPE",

            "HS" => "HS",
            "HORS SERVICE" => "HS",
            "HORS-SERVICE" => "HS",

            "S" => "SERVICE",
            "SERVICE" => "SERVICE",
            "EN SERVICE" => "SERVICE",
            "EN-SERVICE" => "SERVICE",

            "RESERVE" => "RESERVE",
            "RÉSERVÉ" => "RESERVE",
            "RESERVÉ" => "RESERVE",
            "RÉSERVE" => "RESERVE",
            "RESERVEE" => "RESERVE",
            "RÉSERVÉE" => "RESERVE",

            _ => value
        };
    }

    private static bool IsOutilEnService(string? status)
    {
        var normalized = NormalizeStatus(status);

        return normalized == "SERVICE"
            || normalized == "RESERVE";
    }

    private static bool IsOutilReserve(string? status)
    {
        return NormalizeStatus(status) == "RESERVE";
    }
}