'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface UnitSettings {
  temperature: 'celsius' | 'fahrenheit';
  windSpeed: 'kmh' | 'mph';
  precipitation: 'mm' | 'in';
}

interface WeatherData {
  location: string;
  country: string;
  date: string;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    condition: string;
  };
  hourly: Array<{
    time: string;
    temp: number;
    condition: string;
  }>;
  daily: Array<{
    date: string;
    day: string;
    high: number;
    low: number;
    condition: string;
  }>;
}

interface LocationSuggestion {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [units, setUnits] = useState<UnitSettings>({
    temperature: 'celsius',
    windSpeed: 'kmh',
    precipitation: 'mm'
  });
  const [isSearching, setIsSearching] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getWeatherIcon = (condition: string) => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('sun') || conditionLower.includes('clear')) return '/icon-sunny.webp';
    if (conditionLower.includes('cloud') && conditionLower.includes('part')) return '/icon-partly-cloudy.webp';
    if (conditionLower.includes('overcast') || conditionLower.includes('cloud')) return '/icon-overcast.webp';
    if (conditionLower.includes('rain')) return '/icon-rain.webp';
    if (conditionLower.includes('drizzle')) return '/icon-drizzle.webp';
    if (conditionLower.includes('snow')) return '/icon-snow.webp';
    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return '/icon-storm.webp';
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) return '/icon-fog.webp';
    return '/icon-sunny.webp';
  };

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
      );
      const data = await res.json();
      
      if (data.results) {
        setSuggestions(data.results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const searchWeather = async (query: string, lat?: number, lon?: number) => {
    if (!query.trim() && !lat) return;
    
    setIsSearching(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      let location;
      
      if (lat && lon) {
        location = { latitude: lat, longitude: lon, name: query.split(',')[0], country: query.split(',')[1]?.trim() || '' };
      } else {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          setError('No results found. Please try another location.');
          setIsSearching(false);
          return;
        }
        location = geoData.results[0];
      }

      const precipUnit = units.precipitation === 'mm' ? 'mm' : 'inch';
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${units.temperature}&wind_speed_unit=${units.windSpeed}&precipitation_unit=${precipUnit}&timezone=auto`
      );
      const weatherApiData = await weatherRes.json();
      
      const weatherCodes: { [key: number]: string } = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
        61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow',
        75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
        95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
      };
      
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
      
      setWeatherData({
        location: location.name,
        country: location.country,
        date: dateStr,
        current: {
          temp: Math.round(weatherApiData.current.temperature_2m),
          feelsLike: Math.round(weatherApiData.current.apparent_temperature),
          humidity: weatherApiData.current.relative_humidity_2m,
          windSpeed: Math.round(weatherApiData.current.wind_speed_10m),
          precipitation: weatherApiData.current.precipitation,
          condition: weatherCodes[weatherApiData.current.weather_code] || 'Clear'
        },
        hourly: weatherApiData.hourly.time.slice(0, 8).map((time: string, i: number) => {
          const hour = new Date(time).getHours();
          const period = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return {
            time: `${displayHour} ${period}`,
            temp: Math.round(weatherApiData.hourly.temperature_2m[i]),
            condition: weatherCodes[weatherApiData.hourly.weather_code[i]] || 'Clear'
          };
        }),
        daily: weatherApiData.daily.time.slice(0, 7).map((date: string, i: number) => ({
          date,
          day: days[new Date(date).getDay()].substring(0, 3),
          high: Math.round(weatherApiData.daily.temperature_2m_max[i]),
          low: Math.round(weatherApiData.daily.temperature_2m_min[i]),
          condition: weatherCodes[weatherApiData.daily.weather_code[i]] || 'Clear'
        }))
      });
    } catch (err) {
      setError('Unable to fetch weather data. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    searchWeather('Berlin');
  }, [units]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSuggestions(false);
      }
      if (!target.closest('.units-dropdown')) {
        setShowUnitsDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1f] text-white p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">☀</span>
            </div>
            <span className="text-xl font-semibold">Weather Now</span>
          </div>
          
          <div className="relative units-dropdown">
            <button
              onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}
              className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 hover:border-blue-500 transition-colors"
            >
              <Image src="/icon-units.svg" alt="Units" width={16} height={16} />
              <span className="text-sm">Units</span>
              <Image src="/icon-dropdown.svg" alt="Dropdown" width={10} height={10} />
            </button>
            
            {showUnitsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden z-10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">Switch to {units.temperature === 'celsius' ? 'Imperial' : 'Metric'}</span>
                  <button onClick={() => setShowUnitsDropdown(false)} className="text-neutral-400 hover:text-white">
                    ✕
                  </button>
                </div>
                
                {/* Temperature */}
                <div className="mb-4">
                  <p className="text-xs text-neutral-400 mb-2">Temperature</p>
                  <button
                    onClick={() => setUnits({...units, temperature: 'celsius'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>Celsius (°C)</span>
                    {units.temperature === 'celsius' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                  <button
                    onClick={() => setUnits({...units, temperature: 'fahrenheit'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>Fahrenheit (°F)</span>
                    {units.temperature === 'fahrenheit' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                </div>

                {/* Wind Speed */}
                <div className="mb-4">
                  <p className="text-xs text-neutral-400 mb-2">Wind Speed</p>
                  <button
                    onClick={() => setUnits({...units, windSpeed: 'kmh'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>km/h</span>
                    {units.windSpeed === 'kmh' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                  <button
                    onClick={() => setUnits({...units, windSpeed: 'mph'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>mph</span>
                    {units.windSpeed === 'mph' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                </div>

                {/* Precipitation */}
                <div>
                  <p className="text-xs text-neutral-400 mb-2">Precipitation</p>
                  <button
                    onClick={() => setUnits({...units, precipitation: 'mm'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>Millimeters (mm)</span>
                    {units.precipitation === 'mm' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                  <button
                    onClick={() => setUnits({...units, precipitation: 'in'})}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 rounded flex items-center justify-between"
                  >
                    <span>Inches (in)</span>
                    {units.precipitation === 'in' && <Image src="/icon-checkmark.svg" alt="Selected" width={16} height={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-8">How&apos;s the sky looking today?</h1>
          <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
            <div className="relative flex-1 search-container">
              <Image src="/icon-search.svg" alt="Search" width={20} height={20} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchSuggestions(e.target.value);
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchWeather(searchQuery)}
                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                placeholder="Search for a place..."
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-12 py-3 text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-neutral-500 transition-all duration-300"
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden z-20 shadow-xl">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchQuery(`${suggestion.name}, ${suggestion.country}`);
                        searchWeather(`${suggestion.name}, ${suggestion.country}`, suggestion.latitude, suggestion.longitude);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-neutral-700 transition-colors flex items-center gap-3"
                    >
                      <Image src="/icon-search.svg" alt="" width={16} height={16} className="opacity-50" />
                      <div>
                        <p className="text-sm font-medium">{suggestion.name}</p>
                        <p className="text-xs text-neutral-400">{suggestion.country}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => searchWeather(searchQuery)}
              className="bg-blue-500 hover:bg-blue-600 px-8 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
            >
              Search
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto">
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-20">
            <Image src="/icon-loading.svg" alt="Loading" width={48} height={48} className="animate-spin" />
            <p className="mt-4 text-neutral-400">Loading weather data...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <Image src="/icon-error.svg" alt="Error" width={48} height={48} />
            <p className="mt-4 text-neutral-400">{error}</p>
            <button
              onClick={() => searchWeather(searchQuery || 'Berlin')}
              className="mt-4 flex items-center gap-2 bg-blue-500 px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Image src="/icon-retry.svg" alt="Retry" width={16} height={16} />
              Retry
            </button>
          </div>
        )}

        {!isSearching && !error && weatherData && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left Column: Main Weather + Weather Details + Daily Forecast */}
            <div className="space-y-6">
              {/* Main Weather Card */}
              <div className="bg-linear-to-br from-blue-600 to-blue-500 rounded-3xl p-8 relative overflow-hidden min-h-[280px] flex items-center transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20">
                {/* Background cloud image */}
                <div className="absolute inset-0 opacity-5">
                  <Image src="/bg-today-large.svg" alt="" fill className="object-cover" />
                </div>
                
                {/* Decorative circles with animation */}
                <div className="absolute top-8 right-1/4 w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-purple-300 rounded-full animate-pulse delay-100"></div>
                <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-orange-300 rounded-full animate-pulse delay-200"></div>
                
                <div className="relative z-10 flex items-center justify-between w-full gap-4">
                  {/* Left: Location and Date */}
                  <div className="shrink-0 animate-fade-in">
                    <h2 className="text-2xl font-bold mb-1">{weatherData.location}, {weatherData.country}</h2>
                    <p className="text-blue-100 text-sm">{weatherData.date}</p>
                  </div>

                  {/* Right side: Weather Icon + Temperature closer together */}
                  <div className="flex items-center gap-6 shrink-0">
                    {/* Weather Icon */}
                    <div className="animate-float">
                      <Image 
                        src={getWeatherIcon(weatherData.current.condition)} 
                        alt={weatherData.current.condition}
                        width={100}
                        height={100}
                      />
                    </div>

                    {/* Temperature */}
                    <div className="text-8xl font-bold font-['Bricolage_Grotesque'] animate-fade-in">
                      {weatherData.current.temp}°
                    </div>
                  </div>
                </div>
              </div>

              {/* Weather Details - Outside blue card */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-800/50 rounded-2xl p-4 transition-all duration-300 hover:bg-neutral-800/70 hover:scale-105 hover:shadow-lg animate-slide-up delay-100">
                  <p className="text-neutral-400 text-xs mb-1">Feels Like</p>
                  <p className="text-xl font-bold">{weatherData.current.feelsLike}°</p>
                </div>
                <div className="bg-neutral-800/50 rounded-2xl p-4 transition-all duration-300 hover:bg-neutral-800/70 hover:scale-105 hover:shadow-lg animate-slide-up delay-200">
                  <p className="text-neutral-400 text-xs mb-1">Humidity</p>
                  <p className="text-xl font-bold">{weatherData.current.humidity}%</p>
                </div>
                <div className="bg-neutral-800/50 rounded-2xl p-4 transition-all duration-300 hover:bg-neutral-800/70 hover:scale-105 hover:shadow-lg animate-slide-up delay-300">
                  <p className="text-neutral-400 text-xs mb-1">Wind</p>
                  <p className="text-xl font-bold">{weatherData.current.windSpeed} {units.windSpeed}</p>
                </div>
                <div className="bg-neutral-800/50 rounded-2xl p-4 transition-all duration-300 hover:bg-neutral-800/70 hover:scale-105 hover:shadow-lg animate-slide-up delay-400">
                  <p className="text-neutral-400 text-xs mb-1">Precipitation</p>
                  <p className="text-xl font-bold">{weatherData.current.precipitation} {units.precipitation}</p>
                </div>
              </div>

              {/* Daily Forecast */}
              <div className="bg-neutral-800/50 rounded-3xl p-6 animate-slide-up delay-400">
                <h3 className="text-lg font-semibold mb-6">Daily forecast</h3>
                <div className="grid grid-cols-7 gap-3">
                  {weatherData.daily.map((day, i) => (
                    <div 
                      key={i}
                      className="bg-neutral-700/30 rounded-2xl p-3 text-center hover:bg-neutral-700/50 transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer"
                    >
                      <p className="text-sm font-medium mb-2">{day.day}</p>
                      <Image 
                        src={getWeatherIcon(day.condition)} 
                        alt={day.condition}
                        width={40}
                        height={40}
                        className="mx-auto mb-2"
                      />
                      <div className="space-y-0.5">
                        <p className="text-base font-bold">{day.high}°</p>
                        <p className="text-xs text-neutral-400">{day.low}°</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Hourly Forecast - Full Height */}
            <div className="bg-neutral-800/50 rounded-3xl p-6 lg:row-span-2 animate-slide-up delay-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Hourly forecast</h3>
                <button className="flex items-center gap-2 text-sm bg-neutral-700/50 px-3 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span>Tuesday</span>
                  <Image src="/icon-dropdown.svg" alt="Dropdown" width={10} height={10} />
                </button>
              </div>
              
              <div className="space-y-3">
                {weatherData.hourly.map((hour, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 bg-neutral-700/30 rounded-xl hover:bg-neutral-700/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Image 
                        src={getWeatherIcon(hour.condition)} 
                        alt={hour.condition}
                        width={28}
                        height={28}
                      />
                      <span className="text-sm font-medium">{hour.time}</span>
                    </div>
                    <span className="text-lg font-semibold">{hour.temp}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
