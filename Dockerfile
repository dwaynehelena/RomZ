FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    procps \
    lsof \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Set environment variables (defaults)
ENV ROM_BASE_PATH=/roms
ENV CLIENT_DIR=/app/client
ENV HOST=0.0.0.0
ENV PORT=8000

# Command to run the application
CMD ["python", "server/main.py"]
