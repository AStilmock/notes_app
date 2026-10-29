require "test_helper"

class PwaTest < ActionDispatch::IntegrationTest
  test "manifest is public and points at the app icons" do
    get pwa_manifest_url(format: :json)
    assert_response :success

    manifest = response.parsed_body
    assert_equal "standalone", manifest["display"]
    assert_equal "#000000", manifest["theme_color"]
    manifest["icons"].each { |icon| assert File.exist?(Rails.public_path.join(icon["src"].delete_prefix("/"))), icon["src"] }
    assert manifest["icons"].any? { |icon| icon["purpose"] == "maskable" }
  end

  test "service worker is public, precaches the fingerprinted shell, and never caches auth pages" do
    get pwa_service_worker_url(format: :js)
    assert_response :success
    assert_match %r{"/assets/tailwind-\h+\.css"}, response.body
    assert_match %r{"/assets/vt323-latin-400-normal-\h+\.woff2"}, response.body
    assert_match %r{NEVER_CACHE = \["/session", "/passwords", "/registration"\]}, response.body
  end

  test "layout links the manifest and iOS install tags" do
    get new_session_url
    assert_select "link[rel=manifest][href=?]", pwa_manifest_path(format: :json)
    assert_select "link[rel=apple-touch-icon][href=?]", "/apple-touch-icon.png"
    assert_select "meta[name=viewport][content*=?]", "viewport-fit=cover"
  end

  test "login page clears cached pages; logout button does too" do
    get new_session_url
    assert_select "[data-controller=offline-cache][data-offline-cache-clear-on-connect-value=true]"

    sign_in_as users(:one)
    get note_pads_url
    assert_select "nav form[data-controller=offline-cache][data-action=?]", "submit->offline-cache#clear"
  end
end
