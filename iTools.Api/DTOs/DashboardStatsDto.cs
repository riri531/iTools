namespace iTools.Api.DTOs;

public class DashboardStatsDto
{
    public int TotalOutils { get; set; }
    public int TotalUsers { get; set; }
    public int TotalEmplacements { get; set; }

    public int EmplacementsLibres { get; set; }
    public int EmplacementsOccupes { get; set; }
    public int EmplacementsHs { get; set; }

    public int OutilsEnService { get; set; }
    public int OutilsHs { get; set; }
    public int OutilsReserves { get; set; }

    public List<string> PieLabels { get; set; } = new();
    public List<int> PieData { get; set; } = new();

    public List<string> BarLabels { get; set; } = new();
    public List<int> BarData { get; set; } = new();
}