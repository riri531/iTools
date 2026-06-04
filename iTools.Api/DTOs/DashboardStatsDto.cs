using System.Text.Json.Serialization;

namespace iTools.Api.DTOs;

public class DashboardStatsDto
{
    [JsonPropertyName("totalOutils")]
    public int TotalOutils { get; set; }

    [JsonPropertyName("totalUsers")]
    public int TotalUsers { get; set; }

    [JsonPropertyName("totalEmplacements")]
    public int TotalEmplacements { get; set; }

    [JsonPropertyName("emplacementsLibres")]
    public int EmplacementsLibres { get; set; }

    [JsonPropertyName("emplacementsOccupes")]
    public int EmplacementsOccupes { get; set; }

    [JsonPropertyName("emplacementsHs")]
    public int EmplacementsHs { get; set; }

    [JsonPropertyName("outilsEnService")]
    public int OutilsEnService { get; set; }

    [JsonPropertyName("outilsHs")]
    public int OutilsHs { get; set; }

    [JsonPropertyName("outilsReserves")]
    public int OutilsReserves { get; set; }

    [JsonPropertyName("pieLabels")]
    public List<string> PieLabels { get; set; } = new();

    [JsonPropertyName("pieData")]
    public List<int> PieData { get; set; } = new();

    [JsonPropertyName("barLabels")]
    public List<string> BarLabels { get; set; } = new();

    [JsonPropertyName("barData")]
    public List<int> BarData { get; set; } = new();
}