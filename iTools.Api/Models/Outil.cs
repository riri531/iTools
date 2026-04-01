namespace iTools.Api.Models;

public class Outil
{
    public int Id { get; set; }

    public int LigneId { get; set; }
    public Ligne? Ligne { get; set; }

    public int ClientId { get; set; }
    public Client? Client { get; set; }

    public int FournisseurId { get; set; }
    public Fournisseur? Fournisseur { get; set; }

    public int EmplacementId { get; set; }
    public Emplacement? Emplacement { get; set; }

    public string OTT { get; set; } = string.Empty;
    public string CodeOutillage { get; set; } = string.Empty;
    public string Status { get; set; } = "S";
    public decimal Valeur { get; set; }
    public string? JustificationHS { get; set; }
    public DateTime? DateAffectation { get; set; }
}