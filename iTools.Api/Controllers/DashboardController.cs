using iTools.Api.Data;
using iTools.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        var totalOutils = await _context.Outils.CountAsync();
        var totalUsers = await _context.Users.CountAsync();
        var totalEmplacements = await _context.Emplacements.CountAsync();

        var emplacementsLibres = await _context.Emplacements.CountAsync(e => e.Status == "LIBRE");
        var emplacementsOccupes = await _context.Emplacements.CountAsync(e => e.Status == "OCCUPE");
        var emplacementsHs = await _context.Emplacements.CountAsync(e => e.Status == "HS");

        var outilsEnService = await _context.Outils.CountAsync(o => o.Status == "S");
        var outilsHs = await _context.Outils.CountAsync(o => o.Status == "HS");
        var outilsReserves = await _context.Outils.CountAsync(o => o.Status == "RESERVE");

        // Graphique camembert : répartition des emplacements
        var pieLabels = new List<string> { "LIBRE", "OCCUPE", "HS" };
        var pieData = new List<int> { emplacementsLibres, emplacementsOccupes, emplacementsHs };

        // Graphique bâtons : outils réservés par code outillage
        // Si aucun outil n'est réservé, on affiche les 10 premiers outils avec 0/1 selon RESERVE.
        var reservedTools = await _context.Outils
            .Where(o => o.Status == "RESERVE")
            .OrderBy(o => o.CodeOutillage)
            .Select(o => o.CodeOutillage)
            .ToListAsync();

        List<string> barLabels;
        List<int> barData;

        if (reservedTools.Count > 0)
        {
            barLabels = reservedTools;
            barData = reservedTools.Select(_ => 1).ToList();
        }
        else
        {
            var tools = await _context.Outils
                .OrderBy(o => o.CodeOutillage)
                .Take(10)
                .Select(o => new { o.CodeOutillage, o.Status })
                .ToListAsync();

            barLabels = tools.Select(t => t.CodeOutillage).ToList();
            barData = tools.Select(t => t.Status == "RESERVE" ? 1 : 0).ToList();
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
}