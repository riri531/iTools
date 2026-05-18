using iTools.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class ArchivesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ArchivesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var archives = await _context.ArchiveLogs
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.UserId,
                    a.UserName,
                    a.Role,
                    a.Action,
                    a.EntityName,
                    a.EntityId,
                    a.Description,
                    a.OldValues,
                    a.NewValues,
                    a.CreatedAt
                })
                .ToListAsync();

            return Ok(archives);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var archive = await _context.ArchiveLogs
                .FirstOrDefaultAsync(a => a.Id == id);

            if (archive == null)
            {
                return NotFound("Archive introuvable.");
            }

            return Ok(archive);
        }

        [HttpGet("entity/{entityName}")]
        public async Task<IActionResult> GetByEntity(string entityName)
        {
            var archives = await _context.ArchiveLogs
                .Where(a => a.EntityName == entityName)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(archives);
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUser(int userId)
        {
            var archives = await _context.ArchiveLogs
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(archives);
        }

        [HttpGet("date/{date}")]
        public async Task<IActionResult> GetByDate(string date)
        {
            if (!DateTime.TryParse(date, out var parsedDate))
            {
                return BadRequest("Date invalide. Format attendu : yyyy-MM-dd.");
            }

            var start = parsedDate.Date;
            var end = start.AddDays(1);

            var archives = await _context.ArchiveLogs
                .Where(a => a.CreatedAt >= start && a.CreatedAt < end)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(archives);
        }
    }
}