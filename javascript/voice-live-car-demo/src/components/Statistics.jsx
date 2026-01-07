import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function Statistics({ metrics, config }) {
  const textCacheRate = metrics.tokens.input_text > 0 
    ? ((metrics.tokens.cached_text / metrics.tokens.input_text) * 100).toFixed(1)
    : '0.0';
  
  const audioCacheRate = metrics.tokens.input_audio > 0 
    ? ((metrics.tokens.cached_audio / metrics.tokens.input_audio) * 100).toFixed(1)
    : '0.0';

  // Convert audio tokens to seconds
  // Input: 1 token = 0.1 seconds (token / 10)
  // Output: 1 token = 0.05 seconds (token / 20)
  const inputAudioSec = (metrics.tokens.input_audio / 10).toFixed(2);
  const outputAudioSec = (metrics.tokens.output_audio / 20).toFixed(2);

  const exportToCalculator = () => {
    const turns = metrics.turns || 1;
    
    // Calculate averages per turn
    const avgInputText = turns > 0 ? Math.round(metrics.tokens.input_text / turns) : 0;
    const avgOutputText = turns > 0 ? Math.round(metrics.tokens.output_text / turns) : 0;
    const avgInputAudioSec = turns > 0 ? ((metrics.tokens.input_audio / 10) / turns).toFixed(2) : '0';
    const avgOutputAudioSec = turns > 0 ? ((metrics.tokens.output_audio / 20) / turns).toFixed(2) : '0';
    
    const baseUrl = 'https://novaaidesigner.github.io/azure-voice-live-calculator/';
    const params = new URLSearchParams({
      dau: '1000',
      turns: turns.toString(),
      inputAudio: avgInputAudioSec,
      outputAudio: avgOutputAudioSec,
      inputText: avgInputText.toString(),
      model: config.model,
      avatar: 'none',
      textCache: textCacheRate,
      audioCache: audioCacheRate,
      tts: 'openai-realtime'
    });
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 size={16} /> Statistics
        </h3>
        <button
          onClick={exportToCalculator}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold"
        >
          Export to Calculator
        </button>
      </div>

      {/* Token Usage */}
      <div className="mb-4">
        <h4 className="text-xs text-gray-400 mb-2 font-semibold">Token Usage</h4>
        {/* Text Row */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Input Text</div>
            <div className="text-white font-semibold">{metrics.tokens.input_text} token</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Text Cache Rate</div>
            <div className="text-yellow-400 font-semibold">{textCacheRate}%</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Output Text</div>
            <div className="text-white font-semibold">{metrics.tokens.output_text} token</div>
          </div>
        </div>
        {/* Audio Row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Input Audio</div>
            <div className="text-white font-semibold">{metrics.tokens.input_audio} token ({inputAudioSec} sec)</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Audio Cache Rate</div>
            <div className="text-orange-400 font-semibold">{audioCacheRate}%</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Output Audio</div>
            <div className="text-white font-semibold">{metrics.tokens.output_audio} token ({outputAudioSec} sec)</div>
          </div>
        </div>
      </div>

      {/* Latency */}
      <div>
        <h4 className="text-xs text-gray-400 mb-2 font-semibold">Voice Input → Voice Output Latency (ms)</h4>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Min</div>
            <div className="text-white font-semibold">{metrics.latency.min}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Avg</div>
            <div className="text-white font-semibold">{metrics.latency.avg}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">Max</div>
            <div className="text-white font-semibold">{metrics.latency.max}</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="text-gray-400">P90</div>
            <div className="text-white font-semibold">{metrics.latency.p90}</div>
          </div>
        </div>
      </div>

      {/* Turn Count */}
      <div className="mt-3 text-xs text-gray-400">
        Total Turns: <span className="text-white font-semibold">{metrics.turns}</span>
      </div>
    </div>
  );
}
