package executor

// classify maps transport errors to ErrorClass.
// Task 6: only HTTP responses use ClassHTTP via Execute; full mapping is Task 7.
func classify(err error) ErrorClass {
	if err == nil {
		return ""
	}
	return ClassHTTP
}
