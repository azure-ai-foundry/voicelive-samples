# Azure Voice Live - Car Assistant Demo

This is a Javascript (React + Vite) demo for the Azure Voice Live (Realtime API) in a Car Assistant scenario.

**Live Demo:** [https://novaaidesigner.github.io/azure-voice-live-for-car/](https://novaaidesigner.github.io/azure-voice-live-for-car/)

## Demo Description

This demo showcases a **Voice-Enabled Car Assistant** powered by Azure OpenAI Realtime API. It simulates a realistic Electric Vehicle (EV) environment where the user can interact with the car using natural voice commands.

**Key Scenarios:**
- **Vehicle Control**: "Turn on the lights", "Open the windows", "Set temperature to 22 degrees".
- **Status Monitoring**: "What is my current speed?", "How much battery do I have left?".
- **Media & Navigation**: "Play some rock music", "Navigate to the nearest charging station".
- **Real-time Simulation**: The demo includes a background simulation of an EV driving cycle (EPA), affecting battery range and speed in real-time.

## Features

- **Car Assistant Agent**: Configurable AI agent that can control car devices and check status.
- **Tools**:
  - `set_car_feature`: Control lights, windows, music, temperature.
  - `get_car_status`: Check current car status.
  - `use_value_added_service`: Simulate using navigation or entertainment services.
- **Benchmarking**: Tracks latency (simulated/basic) and token usage.
- **Export to Calculator**: Export usage metrics to the VoiceLive Calculator for billing estimation.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Application**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Open the URL shown in the terminal (usually `http://localhost:5173`).

## Configuration

To use the demo, you need an Azure Foundry resource with OpenAI models.

1.  Enter your **Endpoint** (e.g., `https://<resource>.cognitiveservices.azure.com/`).
2.  Enter your **API Key**.
3.  Click **Connect**.

## Usage

- **Microphone**: Click the microphone icon to start/stop recording (Note: Audio streaming implementation in `realtimeService.js` is a placeholder for the WebSocket audio stream. You may need to implement the specific audio buffer handling for the Realtime API).
- **Tools**: The AI will automatically call tools based on your voice commands (e.g., "Turn on the lights", "What's the temperature?").
- **Calculator**: Click "Export to Calculator" to see the estimated cost based on your session usage.

## Project Structure

- `src/App.jsx`: Main application logic and UI.
- `src/services/realtimeService.js`: WebSocket client for Azure Realtime API.
- `src/tools/carTools.js`: Tool definitions and execution logic.
