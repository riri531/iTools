namespace iTools.Api.DTOs;

public class LoginRequestDto
{
    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string RecaptchaToken { get; set; } = string.Empty;
}