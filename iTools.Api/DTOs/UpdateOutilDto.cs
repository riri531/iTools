namespace iTools.Api.DTOs;

public class UpdateOutilDto
{
    public int LigneId { get; set; }
    public int ClientId { get; set; }
    public int FournisseurId { get; set; }
    public int EmplacementId { get; set; }

    public string OTT { get; set; } = string.Empty;
    public string CodeOutillage { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal Valeur { get; set; }
    public string? JustificationHS { get; set; }
    public DateTime? DateAffectation { get; set; }
}