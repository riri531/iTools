namespace iTools.Api.DTOs;

public class ClientDto
{
    public int Id { get; set; }
    public string NomClient { get; set; } = string.Empty;
    public string NomFamille { get; set; } = string.Empty;
    public string NomReference { get; set; } = string.Empty;
}