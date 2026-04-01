namespace iTools.Api.Models;

public class Client
{
    public int Id { get; set; }
    public string NomClient { get; set; } = string.Empty;
    public string NomFamille { get; set; } = string.Empty;
    public string NomReference { get; set; } = string.Empty;
}