# Car Service Management System

A comprehensive automotive service management system designed for Bosch Service operations. This application provides an efficient way to manage parts inventory, create work orders, and generate PDF reports for automotive service centers.

## Features

- **Parts Management**: Search, add, update, and delete automotive parts from database
- **Work Order Creation**: Generate professional PDF work orders with customer and vehicle information
- **Cart System**: Add parts and labor to cart with automatic price calculations
- **PDF Generation**: Automated PDF creation with dynamic file naming
- **Multi-tab Interface**: Organized sections for different operations
- **Real-time Search**: Fast and efficient parts search functionality
- **Currency Support**: Support for both EUR and TL pricing

## Technology Stack

- **Backend**: Python, Flask
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **PDF Generation**: pdfkit with wkhtmltopdf
- **Build Tool**: PyInstaller (for executable creation)

## Installation

### Prerequisites
- Python 3.7 or higher
- wkhtmltopdf (for PDF generation)

### Setup
1. Clone the repository:
```bash
git clone https://github.com/your-username/Bosch-Service-Management-System.git
cd Bosch-Service-Management-System
```

2. Install required packages:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

The application will start on `http://127.0.0.1:5000`

## Usage

1. **Customer Information**: Fill in customer details in the first panel
2. **Vehicle Information**: Enter vehicle information in the second panel
3. **Parts Management**: Use the tabs to:
   - Search for existing parts
   - Add external parts
   - Add new parts to database
   - Manage existing parts
   - Add labor services
4. **Cart**: Review items in cart and adjust quantities
5. **Generate Work Order**: Create and download PDF work order

## Database Structure

The application uses SQLite database with the following main table:
- `parts`: Stores part information including code, name, category, and pricing

## File Structure

```
Bosch-Service-Management-System/
├── app.py                 # Main Flask application
├── create_db.py           # Database initialization
├── requirements.txt       # Python dependencies
├── static/               # Static files (CSS, JS, images)
├── templates/            # HTML templates
├── bin/                  # wkhtmltopdf binaries
└── README.md            # This file
```

## Building Executable

To create a standalone executable:

```bash
pyinstaller --onefile --add-data "static;static" --add-data "templates;templates" --add-data "bin;bin" --add-data "parca_veri.db;." app.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is for educational and demonstration purposes.

## Author

**Murat Semih Esmeray**
- Email: semih.esmeray@gmail.com
- LinkedIn: [linkedin.com/in/murat-semih-esmeray](https://linkedin.com/in/murat-semih-esmeray)
- GitHub: [github.com/Mse103454](https://github.com/Mse103454)
