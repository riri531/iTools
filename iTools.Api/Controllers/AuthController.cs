using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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