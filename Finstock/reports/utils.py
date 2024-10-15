from django.core.mail import send_mail
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph
from django.conf import settings
from reportlab.pdfgen import canvas
from io import BytesIO
from django.core.files.base import ContentFile
import csv
import xlsxwriter
from django.db.models import Sum, Avg, Count
import ast
import operator as op

def generate_pdf_report(report):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer)
    styles = getSampleStyleSheet()
    elements = []

    # Add content to the PDF
    elements.append(Paragraph(f"Report: {report.name}", styles['Title']))
    elements.append(Paragraph(f"Description: {report.description}", styles['Normal']))

    for entry in report.entries.all():
        elements.append(Paragraph(entry.title, styles['Heading2']))
        elements.append(Paragraph(entry.content, styles['Normal']))

    doc.build(elements)

    pdf = ContentFile(buffer.getvalue())
    report.pdf_file.save(f"{report.name}_report.pdf", pdf)
    return report.pdf_file

def send_report_email(report, recipient_email):
    email_template = Report.objects.filter(is_template=True, name="Basic Email Template").first()
    
    if not email_template:
        raise ValueError("Email template not found")

    subject_entry = email_template.entries.filter(title="Email Subject").first()
    body_entry = email_template.entries.filter(title="Email Body").first()

    if not subject_entry or not body_entry:
        raise ValueError("Email template is missing subject or body")

    subject_template = Template(subject_entry.content)
    body_template = Template(body_entry.content)

    context = Context({
        'report_name': report.name,
        'recipient_name': recipient_email.split('@')[0]  # Simple way to get a name from email
    })

    subject = subject_template.render(context)
    message = body_template.render(context)

    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [recipient_email]

    pdf_file = generate_pdf_report(report)

    send_mail(
        subject,
        message,
        from_email,
        recipient_list,
        fail_silently=False,
        attachments=[(f"{report.name}_report.pdf", pdf_file.read(), 'application/pdf')]
    )

def export_report_to_csv(report):
    buffer = BytesIO()
    writer = csv.writer(buffer)
    
    # Write headers
    writer.writerow(['Entry Title', 'Content', 'Created At'])
    
    # Write data
    for entry in report.entries.all():
        writer.writerow([entry.title, entry.content, entry.created_at])
    
    buffer.seek(0)
    csv_file = ContentFile(buffer.getvalue())
    report.csv_file.save(f"{report.name}_report.csv", csv_file)
    return report.csv_file

def export_report_to_excel(report):
    buffer = BytesIO()
    workbook = xlsxwriter.Workbook(buffer)
    worksheet = workbook.add_worksheet()
    
    # Write headers
    headers = ['Entry Title', 'Content', 'Created At']
    for col, header in enumerate(headers):
        worksheet.write(0, col, header)
    
    # Write data
    for row, entry in enumerate(report.entries.all(), start=1):
        worksheet.write(row, 0, entry.title)
        worksheet.write(row, 1, entry.content)
        worksheet.write(row, 2, entry.created_at.strftime('%Y-%m-%d %H:%M:%S'))
    
    workbook.close()
    buffer.seek(0)
    excel_file = ContentFile(buffer.getvalue())
    report.excel_file.save(f"{report.name}_report.xlsx", excel_file)
    return report.excel_file

def calculate_custom_field(calculated_field):
    # This is a simplified example. You might need to implement more complex logic
    # based on your specific requirements.
    report = calculated_field.report
    formula = calculated_field.formula
    
    # Example: Count of entries
    if formula == 'COUNT_ENTRIES':
        return report.entries.count()
    
    # Example: Average word count of entries
    elif formula == 'AVG_WORD_COUNT':
        word_counts = [len(entry.content.split()) for entry in report.entries.all()]
        return sum(word_counts) / len(word_counts) if word_counts else 0
    
    # Add more custom calculations as needed
    
    return None  # Return None if the formula is not recognized
