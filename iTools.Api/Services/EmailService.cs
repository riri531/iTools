using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace iTools.Api.Services;

public class EmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink)
    {
        var message = new MimeMessage();

        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Réinitialisation de votre mot de passe iTools";

        var safeName = string.IsNullOrWhiteSpace(fullName) ? "Utilisateur" : fullName;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222;'>
                    <h2>Réinitialisation du mot de passe</h2>

                    <p>Bonjour {safeName},</p>

                    <p>
                        Vous avez demandé la réinitialisation de votre mot de passe
                        pour l'application <strong>iTools</strong>.
                    </p>

                    <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

                    <p>
                        <a href='{resetLink}'
                           style='display:inline-block;
                                  padding:12px 18px;
                                  background:#c1121f;
                                  color:#ffffff;
                                  text-decoration:none;
                                  border-radius:8px;
                                  font-weight:bold;'>
                            Réinitialiser mon mot de passe
                        </a>
                    </p>

                    <p>Ce lien est valable pendant <strong>30 minutes</strong>.</p>

                    <p>
                        Si vous n’êtes pas à l’origine de cette demande,
                        ignorez simplement cet email.
                    </p>

                    <hr />

                    <p style='font-size:12px;color:#666;'>
                        iTools - Gestion d’emplacement des outils
                    </p>
                </div>",
            TextBody = $@"
Bonjour {safeName},

Vous avez demandé la réinitialisation de votre mot de passe iTools.

Lien de réinitialisation :
{resetLink}

Ce lien est valable pendant 30 minutes.

Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.

iTools - Gestion d’emplacement des outils
"
        };

        message.Body = bodyBuilder.ToMessageBody();

        await SendEmailAsync(message);
    }

    public async Task SendAccessRequestAcceptedEmailAsync(
        string toEmail,
        string fullName,
        string loginEmail,
        string temporaryPassword)
    {
        var message = new MimeMessage();

        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Votre demande d’accès iTools a été acceptée";

        var safeName = string.IsNullOrWhiteSpace(fullName) ? "Utilisateur" : fullName;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222;'>
                    <h2>Demande d’accès acceptée</h2>

                    <p>Bonjour {safeName},</p>

                    <p>
                        Votre demande d’accès à l’application <strong>iTools</strong>
                        a été acceptée par l’administrateur.
                    </p>

                    <p>Voici vos informations de connexion :</p>

                    <div style='padding:14px;
                                border-radius:8px;
                                background:#f3f4f6;
                                border:1px solid #ddd;
                                margin:16px 0;'>
                        <p><strong>Email :</strong> {loginEmail}</p>
                        <p><strong>Mot de passe temporaire :</strong> {temporaryPassword}</p>
                    </div>

                    <p>
                        Veuillez vous connecter à l’application puis modifier votre mot de passe
                        dès que possible.
                    </p>

                    <hr />

                    <p style='font-size:12px;color:#666;'>
                        iTools - Gestion d’emplacement des outils
                    </p>
                </div>",
            TextBody = $@"
Bonjour {safeName},

Votre demande d’accès à l’application iTools a été acceptée.

Voici vos informations de connexion :

Email : {loginEmail}
Mot de passe temporaire : {temporaryPassword}

Veuillez vous connecter à l’application puis modifier votre mot de passe dès que possible.

iTools - Gestion d’emplacement des outils
"
        };

        message.Body = bodyBuilder.ToMessageBody();

        await SendEmailAsync(message);
    }


    public async Task SendNewUserCreatedEmailAsync(
        string toEmail,
        string fullName,
        string loginEmail,
        string temporaryPassword,
        string roleName)
    {
        var message = new MimeMessage();

        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Création de votre compte iTools";

        var safeName = string.IsNullOrWhiteSpace(fullName) ? "Utilisateur" : fullName;
        var safeRole = string.IsNullOrWhiteSpace(roleName) ? "Non renseigné" : roleName;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222;'>
                    <h2 style='color:#c1121f;'>Bienvenue sur iTools</h2>

                    <p>Bonjour {safeName},</p>

                    <p>
                        Votre compte a été créé par l’administrateur sur l’application
                        <strong>iTools</strong>.
                    </p>

                    <p>Voici vos informations de connexion :</p>

                    <div style='padding:14px;
                                border-radius:10px;
                                background:#f3f4f6;
                                border:1px solid #ddd;
                                margin:16px 0;'>
                        <p><strong>Email :</strong> {loginEmail}</p>
                        <p><strong>Mot de passe temporaire :</strong> {temporaryPassword}</p>
                        <p><strong>Rôle :</strong> {safeRole}</p>
                    </div>

                    <p>
                        Ce mot de passe respecte les contraintes de sécurité :
                        longueur minimale, majuscule, minuscule, chiffre et caractère spécial.
                    </p>

                    <p>
                        Pour votre sécurité, veuillez vous connecter puis modifier votre mot de passe
                        dès que possible.
                    </p>

                    <hr />

                    <p style='font-size:12px;color:#666;'>
                        iTools - Gestion d’emplacement des outils
                    </p>
                </div>",
            TextBody = $@"
Bonjour {safeName},

Votre compte a été créé par l’administrateur sur l’application iTools.

Voici vos informations de connexion :

Email : {loginEmail}
Mot de passe temporaire : {temporaryPassword}
Rôle : {safeRole}

Ce mot de passe respecte les contraintes de sécurité : longueur minimale, majuscule, minuscule, chiffre et caractère spécial.

Pour votre sécurité, veuillez vous connecter puis modifier votre mot de passe dès que possible.

iTools - Gestion d’emplacement des outils
"
        };

        message.Body = bodyBuilder.ToMessageBody();

        await SendEmailAsync(message);
    }

    public async Task SendAccessRequestRejectedEmailAsync(
        string toEmail,
        string fullName,
        string? reason)
    {
        var message = new MimeMessage();

        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Réponse à votre demande d’accès iTools";

        var safeName = string.IsNullOrWhiteSpace(fullName) ? "Utilisateur" : fullName;

        var safeReason = string.IsNullOrWhiteSpace(reason)
            ? "Aucun motif spécifique n’a été indiqué."
            : reason;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222;'>
                    <h2>Demande d’accès refusée</h2>

                    <p>Bonjour {safeName},</p>

                    <p>
                        Votre demande d’accès à l’application <strong>iTools</strong>
                        n’a pas été acceptée.
                    </p>

                    <div style='padding:14px;
                                border-radius:8px;
                                background:#fff1f2;
                                border:1px solid #fecdd3;
                                margin:16px 0;'>
                        <p><strong>Motif :</strong> {safeReason}</p>
                    </div>

                    <p>
                        Pour plus d’informations, veuillez contacter l’administrateur.
                    </p>

                    <hr />

                    <p style='font-size:12px;color:#666;'>
                        iTools - Gestion d’emplacement des outils
                    </p>
                </div>",
            TextBody = $@"
Bonjour {safeName},

Votre demande d’accès à l’application iTools n’a pas été acceptée.

Motif : {safeReason}

Pour plus d’informations, veuillez contacter l’administrateur.

iTools - Gestion d’emplacement des outils
"
        };

        message.Body = bodyBuilder.ToMessageBody();

        await SendEmailAsync(message);
    }

    private async Task SendEmailAsync(MimeMessage message)
    {
        using var client = new SmtpClient();

        var secureSocketOptions = _settings.UseSsl
            ? SecureSocketOptions.StartTls
            : SecureSocketOptions.Auto;

        await client.ConnectAsync(
            _settings.Host,
            _settings.Port,
            secureSocketOptions
        );

        await client.AuthenticateAsync(
            _settings.Username,
            _settings.Password
        );

        await client.SendAsync(message);

        await client.DisconnectAsync(true);
    }
}