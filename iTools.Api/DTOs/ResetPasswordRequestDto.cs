namespace iTools.Api.DTOs;

public class ResetPasswordRequestDto
{
    public int UserId { get; set; }

    public string Token { get; set; } = string.Empty;

    public string NewPassword { get; set; } = string.Empty;

    public string ConfirmPassword { get; set; } = string.Empty;
}