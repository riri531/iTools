namespace iTools.Api.DTOs;

public class CreateAccessRequestDto
{
    public string FullName { get; set; } = string.Empty;

    public string Matricule { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public string? Message { get; set; }
}