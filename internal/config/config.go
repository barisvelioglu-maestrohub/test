package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Email    EmailConfig    `mapstructure:"email"`
	Security SecurityConfig `mapstructure:"security"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Logging  LoggingConfig  `mapstructure:"logging"`
}

type ServerConfig struct {
	Port            string        `mapstructure:"port"`
	Host            string        `mapstructure:"host"`
	ReadTimeout     time.Duration `mapstructure:"read_timeout"`
	WriteTimeout    time.Duration `mapstructure:"write_timeout"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
	BaseURL         string        `mapstructure:"base_url"`
	Environment     string        `mapstructure:"environment"`
}

type DatabaseConfig struct {
	Driver          string        `mapstructure:"driver"`
	DSN             string        `mapstructure:"dsn"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

type JWTConfig struct {
	Secret        string        `mapstructure:"secret"`
	AdminExpiry   time.Duration `mapstructure:"admin_expiry"`
	PortalExpiry  time.Duration `mapstructure:"portal_expiry"`
	RefreshExpiry time.Duration `mapstructure:"refresh_expiry"`
}

type EmailConfig struct {
	Provider     string `mapstructure:"provider"`
	APIKey       string `mapstructure:"api_key"`
	FromEmail    string `mapstructure:"from_email"`
	FromName     string `mapstructure:"from_name"`
	SMTPHost     string `mapstructure:"smtp_host"`
	SMTPPort     int    `mapstructure:"smtp_port"`
	SMTPUser     string `mapstructure:"smtp_user"`
	SMTPPassword string `mapstructure:"smtp_password"`
}

type SecurityConfig struct {
	RateLimitPerMinute int           `mapstructure:"rate_limit_per_minute"`
	ClockSkewTolerance time.Duration `mapstructure:"clock_skew_tolerance"`
	CSRFTokenLength    int           `mapstructure:"csrf_token_length"`
	AllowedOrigins     []string      `mapstructure:"allowed_origins"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type LoggingConfig struct {
	Level      string `mapstructure:"level"`
	Format     string `mapstructure:"format"`
	OutputPath string `mapstructure:"output_path"`
}

func Load(configPath string) (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")

	if configPath != "" {
		viper.AddConfigPath(configPath)
	}
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/license-server/")

	viper.SetEnvPrefix("LICENSE")
	viper.AutomaticEnv()

	setDefaults()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.read_timeout", "15s")
	viper.SetDefault("server.write_timeout", "15s")
	viper.SetDefault("server.shutdown_timeout", "10s")
	viper.SetDefault("server.environment", "development")

	viper.SetDefault("database.driver", "sqlite3")
	viper.SetDefault("database.dsn", "./license.db")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", "5m")

	viper.SetDefault("jwt.admin_expiry", "8h")
	viper.SetDefault("jwt.portal_expiry", "24h")
	viper.SetDefault("jwt.refresh_expiry", "7d")

	viper.SetDefault("email.provider", "smtp")

	viper.SetDefault("security.rate_limit_per_minute", 60)
	viper.SetDefault("security.clock_skew_tolerance", "5m")
	viper.SetDefault("security.csrf_token_length", 32)

	viper.SetDefault("redis.addr", "localhost:6379")
	viper.SetDefault("redis.db", 0)

	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output_path", "stdout")
}