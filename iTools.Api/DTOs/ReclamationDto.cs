namespace iTools.Api.DTOs;

public class ReclamationDto
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string ProblemType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime ReclamationDate { get; set; }

    public string SourcePage { get; set; } = string.Empty;

    public string EntityName { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string EntityLabel { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Priority { get; set; } = string.Empty;

    public string AssignedToRole { get; set; } = string.Empty;

    public int? AssignedToUserId { get; set; }

    public string AssignedToUserName { get; set; } = string.Empty;

    public int CreatedByUserId { get; set; }

    public string CreatedByUserName { get; set; } = string.Empty;

    public string CreatedByUserRole { get; set; } = string.Empty;

    public string? Decision { get; set; }

    public string? Resolution { get; set; }

    public DateTime? TreatedAt { get; set; }

    public int? TreatedByUserId { get; set; }

    public string TreatedByUserName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<ReclamationHistoryDto> Histories { get; set; } = new();
}