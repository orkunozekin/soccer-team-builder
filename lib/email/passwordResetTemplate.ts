function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildPasswordResetEmailHtml(input: {
  email: string
  resetLink: string
  appName?: string
}): string {
  const appName = escapeHtml(input.appName ?? 'Soccerville')
  const email = escapeHtml(input.email)
  const resetLink = escapeHtml(input.resetLink)

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFF9F9;margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;margin:0 auto;">
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <div style="font-size:40px;line-height:1;">⚽</div>
            <div style="margin-top:8px;font-size:32px;font-weight:800;letter-spacing:-1px;color:#CC0000;">
              ${appName}
            </div>
            <div style="margin-top:8px;font-size:15px;line-height:22px;color:#5F5F68;">
              RSVP to games &amp; get automatically assigned to balanced teams
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #DDDDDD;border-top:3px solid #CC0000;border-radius:10px;padding:32px 28px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:24px;font-weight:700;color:#090909;margin-bottom:8px;">
                Reset your password
              </div>
              <div style="font-size:15px;line-height:22px;color:#60606A;">
                We received a request to reset the password for
                <strong style="color:#101010;">${email}</strong>.
              </div>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:8px 0 20px;">
                  <a href="${resetLink}" style="display:inline-block;background-color:#CC0000;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:7px;">
                    Choose a new password
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size:13px;line-height:20px;color:#63718A;text-align:center;word-break:break-all;">
              Or copy and paste this link into your browser:<br />
              <a href="${resetLink}" style="color:#CC0000;text-decoration:underline;">${resetLink}</a>
            </div>

            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #D8D8D8;font-size:13px;line-height:20px;color:#63718A;text-align:center;">
              If you didn’t ask to reset your password, you can ignore this email.
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:20px;font-size:13px;line-height:20px;color:#63718A;">
            Thanks,<br />
            The ${appName} team
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}
