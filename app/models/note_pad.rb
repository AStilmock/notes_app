class NotePad < ApplicationRecord
  include Positioned

  # The body is rich text from note_pad_controller.js. Only these tags survive (no attributes),
  # so pasted or forged HTML can't carry scripts, links or styles.
  BODY_TAGS = %w[b strong i em u s strike del div p br ul ol li].freeze
  BODY_SANITIZER = Rails::HTML::Sanitizer.best_supported_vendor.safe_list_sanitizer.new

  belongs_to :user

  normalizes :body, with: ->(html) { BODY_SANITIZER.sanitize(html, tags: BODY_TAGS, attributes: []) }
end
