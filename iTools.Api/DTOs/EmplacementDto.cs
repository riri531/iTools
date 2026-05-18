namespace iTools.Api.DTOs;

public class EmplacementDto
{
    public int Id { get; set; }

    public int MatiereId { get; set; }
    public string MatiereName { get; set; } = string.Empty;

    public string Armoire { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;

    public int DesignationId { get; set; }
    public string DesignationName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;
}