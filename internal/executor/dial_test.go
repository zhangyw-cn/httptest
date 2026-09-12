package executor

import "testing"

func TestMapDialAddressHit(t *testing.T) {
	addr, ip, hit := mapDialAddress("api.example.com:443", map[string]string{"api.example.com": "10.0.0.5"})
	if !hit || ip != "10.0.0.5" || addr != "10.0.0.5:443" {
		t.Fatalf("%q %q %v", addr, ip, hit)
	}
}

func TestMapDialAddressMissAndIPLiteral(t *testing.T) {
	if _, _, hit := mapDialAddress("other.com:80", map[string]string{"api.example.com": "10.0.0.5"}); hit {
		t.Fatal("miss should not hit")
	}
	if _, _, hit := mapDialAddress("10.0.0.5:80", map[string]string{"10.0.0.5": "1.1.1.1"}); hit {
		t.Fatal("ip literal should not remap")
	}
	if _, _, hit := mapDialAddress("api.example.com:80", nil); hit {
		t.Fatal("nil map")
	}
}

func TestMapDialAddressIPv6(t *testing.T) {
	addr, ip, hit := mapDialAddress("api.example.com:443", map[string]string{"api.example.com": "2001:db8::1"})
	if !hit || ip != "2001:db8::1" || addr != "[2001:db8::1]:443" {
		t.Fatalf("%q %q %v", addr, ip, hit)
	}
}
