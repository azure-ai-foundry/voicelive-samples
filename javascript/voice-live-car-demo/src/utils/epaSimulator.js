// EPA Federal Test Procedure Simulator for BEV
// Total cycle: 1369 seconds (Cold Start 505s + Transient 864s)

export const calculateEPASpeed = (cyclePosition) => {
  let speed;

  // Cold Start Phase: 0-505 seconds
  if (cyclePosition < 505) {
    const coldStartTime = cyclePosition;
    
    // EPA Cold Start patterns (simplified acceleration/deceleration patterns)
    if (coldStartTime < 50) {
      // Initial acceleration 0-50 km/h
      speed = Math.round((coldStartTime / 50) * 60);
    } else if (coldStartTime < 80) {
      // Cruising 60 km/h
      speed = 60;
    } else if (coldStartTime < 130) {
      // Acceleration to peak
      speed = Math.round(60 + ((coldStartTime - 80) / 50) * 30);
    } else if (coldStartTime < 160) {
      // Deceleration 90-30 km/h
      speed = Math.round(90 - ((coldStartTime - 130) / 30) * 60);
    } else if (coldStartTime < 200) {
      // Low speed 30-50 km/h
      speed = Math.round(30 + ((coldStartTime - 160) / 40) * 20);
    } else if (coldStartTime < 320) {
      // Variable speed pattern (avg 40-50 km/h)
      const pattern = Math.sin((coldStartTime - 200) / 120 * Math.PI) * 20 + 40;
      speed = Math.round(pattern);
    } else if (coldStartTime < 360) {
      // Stop phase
      speed = 0;
    } else if (coldStartTime < 410) {
      // Acceleration from stop 0-56.7 km/h
      speed = Math.round(((coldStartTime - 360) / 50) * 56.7);
    } else {
      // High speed cruise 56.7 km/h
      speed = 56;
    }
  } 
  // Transient Phase: 505-1369 seconds (864 seconds duration)
  else {
    const transientTime = cyclePosition - 505;
    
    // EPA Transient patterns with more variation
    if (transientTime < 100) {
      // Rapid acceleration 0-75 km/h
      speed = Math.round((transientTime / 100) * 75);
    } else if (transientTime < 200) {
      // Peak speed and hold 75 km/h
      speed = 75;
    } else if (transientTime < 300) {
      // Deceleration to stop
      speed = Math.round(75 - ((transientTime - 200) / 100) * 75);
    } else if (transientTime < 320) {
      // Stop phase
      speed = 0;
    } else if (transientTime < 420) {
      // Medium acceleration 0-60 km/h
      speed = Math.round(((transientTime - 320) / 100) * 60);
    } else if (transientTime < 500) {
      // Cruise 60 km/h
      speed = 60;
    } else if (transientTime < 620) {
      // Variable speed pattern
      const pattern = Math.sin((transientTime - 500) / 120 * Math.PI * 2) * 20 + 40;
      speed = Math.round(Math.max(0, pattern));
    } else if (transientTime < 700) {
      // Acceleration 0-56.7 km/h
      speed = Math.round(((transientTime - 620) / 80) * 56.7);
    } else {
      // Final cruise 56.7 km/h
      speed = 56;
    }
  }

  return speed;
};

export const calculateBatteryConsumption = (speed) => {
  // Battery consumption based on speed
  // Higher consumption at higher speeds, minimal at idle
  let consumption = 0.0005; // Base idle consumption
  if (speed > 0) {
    consumption = 0.0001 + (speed / 100) * 0.003; // Scales with speed
  }
  return consumption;
};

export const EPA_CYCLE_DURATION = 1369; // Total cycle time in seconds
