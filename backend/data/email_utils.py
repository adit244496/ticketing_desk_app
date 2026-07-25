import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

OUTLOOK_EMAIL = os.environ.get('OUTLOOK_EMAIL')
OUTLOOK_PASSWORD = os.environ.get('OUTLOOK_PASSWORD')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp-mail.outlook.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

def send_ticket_email(to_email, subject, message_body, ticket_details=None, cc_emails=None, attachment_filepath=None):
    if not OUTLOOK_EMAIL or not OUTLOOK_PASSWORD:
        print("Outlook credentials not configured. Skipping email.")
        return
        
    if not to_email:
        return

    msg = MIMEMultipart()
    msg['From'] = OUTLOOK_EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject

    if cc_emails:
        if isinstance(cc_emails, list):
            msg['Cc'] = ', '.join(cc_emails)
        else:
            msg['Cc'] = cc_emails

    # Convert message to HTML
    html_body = f"<p>{message_body.replace(chr(10), '<br>')}</p>"
    
    if ticket_details:
        html_body += "<h3>--- Ticket Details ---</h3><ul>"
        for key, value in ticket_details.items():
            html_body += f"<li><strong>{key}:</strong> {value}</li>"
        html_body += "</ul>"
        
        ticket_id = ticket_details.get('Ticket ID')
        if ticket_id:
            html_body += f"<p><a href='{FRONTEND_URL}/ticket/{ticket_id}' style='padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;'>View Ticket in Dashboard</a></p>"
            
    html_body += "<br><p style='color: gray; font-size: 12px;'>This is an automated notification.</p>"

    # Check if there is an image attachment
    is_image = False
    attachment_filename = ""
    if attachment_filepath and os.path.exists(attachment_filepath):
        attachment_filename = os.path.basename(attachment_filepath)
        ext = os.path.splitext(attachment_filepath)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg', '.gif']:
            is_image = True
            html_body += f"<br><h3>Attached Image:</h3><br><img src='cid:{attachment_filename}' style='max-width: 600px; border: 1px solid #ddd;'>"

    msg.attach(MIMEText(html_body, 'html'))

    if attachment_filepath and os.path.exists(attachment_filepath):
        try:
            filename = os.path.basename(attachment_filepath)
            with open(attachment_filepath, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            encoders.encode_base64(part)
            
            # If it's an image, set Content-ID so it can be embedded in HTML
            if is_image:
                part.add_header('Content-ID', f'<{filename}>')
                part.add_header('Content-Disposition', 'inline', filename=filename)
            else:
                part.add_header('Content-Disposition', f"attachment; filename={filename}")
                
            msg.attach(part)
        except Exception as e:
            print(f"Error attaching file {attachment_filepath}: {e}")

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(OUTLOOK_EMAIL, OUTLOOK_PASSWORD)
        
        recipients = [to_email]
        if cc_emails:
            if isinstance(cc_emails, list):
                recipients.extend(cc_emails)
            else:
                recipients.extend([email.strip() for email in cc_emails.split(',') if email.strip()])
                
        server.sendmail(OUTLOOK_EMAIL, recipients, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
