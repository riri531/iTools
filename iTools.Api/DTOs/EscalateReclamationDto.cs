namespace iTools.Api.DTOs;

public class EscalateReclamationDto
{
    public string Reason { get; set; } = string.Empty;

    public string Priority { get; set; } = "HAUTE";
}