namespace iTools.Api.DTOs;

public class CreateReclamationDto
{
    public string Title { get; set; } = string.Empty;

    public string ProblemType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime? ReclamationDate { get; set; }

    public string SourcePage { get; set; } = string.Empty;

    public string EntityName { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string EntityLabel { get; set; } = string.Empty;

    public string Priority { get; set; } = "NORMALE";
}