package utils

import (
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func InitLogger(level string, format string) {
	zerolog.TimeFieldFormat = time.RFC3339

	logLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		logLevel = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(logLevel)

	if format == "pretty" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	} else {
		log.Logger = zerolog.New(os.Stderr).With().Timestamp().Logger()
	}
}

func LoggerMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			err := next(c)

			req := c.Request()
			res := c.Response()

			fields := map[string]interface{}{
				"remote_ip":    c.RealIP(),
				"host":         req.Host,
				"method":       req.Method,
				"uri":          req.RequestURI,
				"status":       res.Status,
				"latency_ms":   time.Since(start).Milliseconds(),
				"user_agent":   req.UserAgent(),
				"bytes_in":     req.ContentLength,
				"bytes_out":    res.Size,
			}

			if err != nil {
				fields["error"] = err.Error()
			}

			user := c.Get("user")
			if user != nil {
				fields["user_id"] = user
			}

			statusCode := res.Status
			msg := "request completed"

			switch {
			case statusCode >= 500:
				log.Error().Fields(fields).Msg(msg)
			case statusCode >= 400:
				log.Warn().Fields(fields).Msg(msg)
			case statusCode >= 300:
				log.Info().Fields(fields).Msg(msg)
			default:
				log.Debug().Fields(fields).Msg(msg)
			}

			return err
		}
	}
}

func GetLogger() zerolog.Logger {
	return log.Logger
}