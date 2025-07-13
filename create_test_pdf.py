#!/usr/bin/env python3
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

def create_test_pdf():
    """Create a simple PDF file with math questions for testing"""
    filename = "test_math_questions.pdf"
    
    # Create a new PDF document
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, height - 72, "Math Test Questions")
    
    # Questions
    questions = [
        "1. What is 2 + 3?",
        "A) 4",
        "B) 5",
        "C) 6", 
        "D) 7",
        "",
        "2. Calculate the area of a rectangle with length 5 and width 3.",
        "A) 8",
        "B) 15",
        "C) 20",
        "D) 25",
        "",
        "3. What is the square root of 16?",
        "A) 2",
        "B) 4",
        "C) 6",
        "D) 8"
    ]
    
    c.setFont("Helvetica", 12)
    y_position = height - 120
    
    for question in questions:
        c.drawString(72, y_position, question)
        y_position -= 20
    
    # Save the PDF
    c.save()
    print(f"Created test PDF: {filename}")

if __name__ == "__main__":
    create_test_pdf()