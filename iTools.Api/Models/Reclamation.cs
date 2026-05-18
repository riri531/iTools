namespace iTools.Api.Models;

public class Reclamation
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string ProblemType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime ReclamationDate { get; set; } = DateTime.Now;

    public string SourcePage { get; set; } = string.Empty;

    public string EntityName { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string EntityLabel { get; set; } = string.Empty;

    public string Status { get; set; } = "EN_ATTENTE";

    public string Priority { get; set; } = "NORMALE";

    public string AssignedToRole { get; set; } = "RESPONSABLE";

    public int? AssignedToUserId { get; set; }

    public User? AssignedToUser { get; set; }

    public int CreatedByUserId { get; set; }

    public User? CreatedByUser { get; set; }

    public string? Decision { get; set; }

    public string? Resolution { get; set; }

    public DateTime? TreatedAt { get; set; }

    public int? TreatedByUserId { get; set; }

    public User? TreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    public ICollection<ReclamationHistory> Histories { get; set; } = new List<ReclamationHistory>();
}