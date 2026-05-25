using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Le mot de passe est obligatoire.");
        }

        var email = request.Email.Trim();

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await AddAuthArchiveAsync(
                userId: null,
                userName: email,
                role: "",
                action: "LOGIN_FAILED",
                description: $"Tentative de connexion échouée pour l’email : {email}",
                oldValues: null,
                newValues: new
                {
                    Email = email,
                    Result = "FAILED",
                    Date = DateTime.Now
                }
            );

            return Unauthorized("Email ou mot de passe incorrect.");
        }

        var roleName = user.Role != null ? user.Role.Name : "";

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, roleName)
        };

        var jwtKey = _configuration["Jwt:Key"];

        if (string.IsNullOrWhiteSpace(jwtKey))
        {
            return StatusCode(500, "La clé JWT est manquante dans la configuration.");
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        await AddAuthArchiveAsync(
            userId: user.Id,
            userName: user.FullName,
            role: roleName,
            action: "LOGIN_SUCCESS",
            description: $"Connexion réussie : {user.FullName}",
            oldValues: null,
            newValues: new
            {
                user.Id,
                user.FullName,
                user.Email,
                Role = roleName,
                Result = "SUCCESS",
                Date = DateTime.Now
            }
        );

        return Ok(new LoginResponseDto
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Email = user.Email,
            FullName = user.FullName,
            Role = roleName
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = null;

        if (int.TryParse(userIdValue, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var userName =
            User.FindFirst(ClaimTypes.Name)?.Value ??
            User.FindFirst(ClaimTypes.Email)?.Value ??
            "Utilisateur inconnu";

        var role =
            User.FindFirst(ClaimTypes.Role)?.Value ??
            "";

        await AddAuthArchiveAsync(
            userId: userId,
            userName: userName,
            role: role,
            action: "LOGOUT",
            description: $"Déconnexion : {userName}",
            oldValues: null,
            newValues: new
            {
                UserId = userId,
                UserName = userName,
                Role = role,
                Result = "LOGOUT",
                Date = DateTime.Now
            }
        );

        return Ok(new
        {
            message = "Déconnexion archivée avec succès."
        });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        var email = request.Email.Trim();

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return Ok(new
            {
                message = "Si cet email existe dans le système, un lien de réinitialisation sera généré."
            });
        }

        var resetToken = GenerateSecureToken();

        user.PasswordResetTokenHash = BCrypt.Net.BCrypt.HashPassword(resetToken);
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(30);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var frontendBaseUrl = _configuration["Frontend:BaseUrl"] ?? "http://localhost:4200";

        var resetLink =
            $"{frontendBaseUrl}/reset-password?userId={user.Id}&token={Uri.EscapeDataString(resetToken)}";

        await AddAuthArchiveAsync(
            userId: user.Id,
            userName: user.FullName,
            role: user.Role?.Name ?? "",
            action: "PASSWORD_RESET_REQUEST",
            description: $"Demande de réinitialisation du mot de passe : {user.Email}",
            oldValues: null,
            newValues: new
            {
                user.Id,
                user.Email,
                Expiration = user.PasswordResetTokenExpiresAt,
                Date = DateTime.Now
            }
        );

        return Ok(new
        {
            message = "Un lien de réinitialisation a été généré.",
            resetLink = resetLink
        });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request)
    {
        if (request.UserId <= 0)
        {
            return BadRequest("Utilisateur invalide.");
        }

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest("Le token de réinitialisation est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest("Le nouveau mot de passe est obligatoire.");
        }

        if (request.NewPassword.Length < 6)
        {
            return BadRequest("Le mot de passe doit contenir au moins 6 caractères.");
        }

        if (request.NewPassword != request.ConfirmPassword)
        {
            return BadRequest("Les mots de passe ne correspondent pas.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == request.UserId);

        if (user == null)
        {
            return BadRequest("Lien de réinitialisation invalide.");
        }

        if (string.IsNullOrWhiteSpace(user.PasswordResetTokenHash) ||
            user.PasswordResetTokenExpiresAt == null)
        {
            return BadRequest("Aucune demande de réinitialisation active.");
        }

        if (user.PasswordResetTokenExpiresAt < DateTime.UtcNow)
        {
            return BadRequest("Le lien de réinitialisation a expiré.");
        }

        var isTokenValid = BCrypt.Net.BCrypt.Verify(
            request.Token,
            user.PasswordResetTokenHash
        );

        if (!isTokenValid)
        {
            return BadRequest("Token de réinitialisation invalide.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetTokenHash = null;
        user.PasswordResetTokenExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await AddAuthArchiveAsync(
            userId: user.Id,
            userName: user.FullName,
            role: user.Role?.Name ?? "",
            action: "PASSWORD_RESET_SUCCESS",
            description: $"Mot de passe réinitialisé : {user.Email}",
            oldValues: null,
            newValues: new
            {
                user.Id,
                user.Email,
                Result = "PASSWORD_RESET_SUCCESS",
                Date = DateTime.Now
            }
        );

        return Ok(new
        {
            message = "Mot de passe réinitialisé avec succès."
        });
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }

    private async Task AddAuthArchiveAsync(
        int? userId,
        string userName,
        string role,
        string action,
        string description,
        object? oldValues,
        object? newValues)
    {
        var archive = new ArchiveLog
        {
            UserId = userId,
            UserName = userName,
            Role = role,
            Action = action,
            EntityName = "Auth",
            EntityId = userId,
            Description = description,
            OldValues = oldValues == null ? null : System.Text.Json.JsonSerializer.Serialize(oldValues),
            NewValues = newValues == null ? null : System.Text.Json.JsonSerializer.Serialize(newValues),
            CreatedAt = DateTime.Now
        };

        _context.ArchiveLogs.Add(archive);
        await _context.SaveChangesAsync();
    }
}