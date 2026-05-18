using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ADMIN")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public UsersController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserListItemDto>>> GetAll()
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .OrderBy(u => u.Id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : ""
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserListItemDto>> GetById(int id)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Id == id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : ""
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserListItemDto>> Create(CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest("Le mot de passe est obligatoire.");
        }

        if (dto.RoleId <= 0)
        {
            return BadRequest("Le rôle est obligatoire.");
        }

        var fullName = dto.FullName.Trim();
        var email = dto.Email.Trim();

        var roleExists = await _context.Roles.AnyAsync(r => r.Id == dto.RoleId);
        if (!roleExists)
        {
            return BadRequest("RoleId invalide.");
        }

        var emailExists = await _context.Users.AnyAsync(u => u.Email == email);
        if (emailExists)
        {
            return BadRequest("Cet email existe déjà.");
        }

        var user = new User
        {
            FullName = fullName,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            RoleId = dto.RoleId
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var createdUser = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Id == user.Id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : ""
            })
            .FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "User",
            entityId: user.Id,
            description: $"Ajout de l’utilisateur : {createdUser.FullName}",
            oldValues: null,
            newValues: new
            {
                createdUser.Id,
                createdUser.FullName,
                createdUser.Email,
                createdUser.RoleId,
                createdUser.RoleName
            }
        );

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, createdUser);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (dto.RoleId <= 0)
        {
            return BadRequest("Le rôle est obligatoire.");
        }

        var fullName = dto.FullName.Trim();
        var email = dto.Email.Trim();

        var roleExists = await _context.Roles.AnyAsync(r => r.Id == dto.RoleId);
        if (!roleExists)
        {
            return BadRequest("RoleId invalide.");
        }

        var emailUsedByAnother = await _context.Users
            .AnyAsync(u => u.Email == email && u.Id != id);

        if (emailUsedByAnother)
        {
            return BadRequest("Cet email est déjà utilisé par un autre utilisateur.");
        }

        var oldValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.RoleId,
            RoleName = user.Role != null ? user.Role.Name : ""
        };

        user.FullName = fullName;
        user.Email = email;
        user.RoleId = dto.RoleId;

        await _context.SaveChangesAsync();

        var updatedUser = await _context.Users
            .Include(u => u.Role)
            .FirstAsync(u => u.Id == id);

        var newValues = new
        {
            updatedUser.Id,
            updatedUser.FullName,
            updatedUser.Email,
            updatedUser.RoleId,
            RoleName = updatedUser.Role != null ? updatedUser.Role.Name : ""
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "User",
            entityId: user.Id,
            description: $"Modification de l’utilisateur : {user.FullName}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var oldValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.RoleId,
            RoleName = user.Role != null ? user.Role.Name : ""
        };

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "User",
            entityId: id,
            description: $"Suppression de l’utilisateur : {oldValues.FullName}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}