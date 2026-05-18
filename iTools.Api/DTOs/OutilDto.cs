namespace iTools.Api.DTOs;

public class OutilDto
{
    public int Id { get; set; }

    public int LigneId { get; set; }
    public string LigneName { get; set; } = string.Empty;

    public int ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;

    public int FournisseurId { get; set; }
    public string FournisseurName { get; set; } = string.Empty;

    public int EmplacementId { get; set; }
    public string EmplacementLabel { get; set; } = string.Empty;

    public string OTT { get; set; } = string.Empty;
    public string CodeOutillage { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal Valeur { get; set; }
    public string? JustificationHS { get; set; }
    public DateTime? DateAffectation { get; set; }
}